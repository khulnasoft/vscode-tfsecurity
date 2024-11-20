import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  sortByCode,
  sortBySeverity,
  sortResults,
  uniqueLocations,
} from "./utils";
import { CheckResult, CheckSeverity } from "./check_result";
import { TfsecurityTreeItem, TfsecurityTreeItemType } from "./tfsecurity_treeitem";
import { checkServerIdentity } from "tls";

export class TfsecurityIssueProvider
  implements vscode.TreeDataProvider<TfsecurityTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    TfsecurityTreeItem | undefined | void
  > = new vscode.EventEmitter<TfsecurityTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<TfsecurityTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;
  public resultData: CheckResult[] = [];
  private taintResults: boolean = true;
  public rootpath: string = "";
  private storagePath: string = "";
  public readonly resultsStoragePath: string = "";
  private diagCollection: vscode.DiagnosticCollection;

  constructor(
    context: vscode.ExtensionContext,
    diagCollection: vscode.DiagnosticCollection
  ) {
    if (context.storageUri) {
      this.storagePath = context.storageUri.fsPath;
      console.log(`storage path is ${this.storagePath}`);
      if (!fs.existsSync(this.storagePath)) {
        fs.mkdirSync(context.storageUri.fsPath);
      }
      this.resultsStoragePath = path.join(
        context.storageUri.fsPath,
        "/.tfsecurity/"
      );
      if (!fs.existsSync(this.resultsStoragePath)) {
        fs.mkdirSync(this.resultsStoragePath);
      }
    }

    this.diagCollection = diagCollection;
  }

  refresh(): void {
    this.taintResults = true;
    this.loadResultData();
  }

  // when there is a tfsecurity output file, load the results
  async loadResultData() {
    var _self = this;
    _self.resultData = [];
    if (
      this.resultsStoragePath !== "" &&
      vscode.workspace &&
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      this.rootpath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      var files = fs
        .readdirSync(this.resultsStoragePath)
        .filter(
          (fn) =>
            fn.endsWith("_results.json") || fn.endsWith("_results.json.json")
        );
      Promise.resolve(
        files.forEach((file) => {
          const resultFile = path.join(this.resultsStoragePath, file);
          if (fs.existsSync(resultFile)) {
            let content = fs.readFileSync(resultFile, "utf8");

            let diagnostics = new Map<string, vscode.Diagnostic[]>();

            try {
              const data = JSON.parse(content);
              if (data === null || data.results === null) {
                return;
              }
              let results = data.results.sort(sortResults);
              for (let i = 0; i < results.length; i++) {
                const element = results[i];
                let result = new CheckResult(element);
                _self.resultData.push(result);

                if (diagnostics.get(result.filename) === undefined) {
                  diagnostics.set(result.filename, []);
                }
                diagnostics
                  .get(result.filename)
                  ?.push(this.processProblem(result));
              }
            } catch {
              console.debug(`Error loading results file ${file}`);
            }

            for (let [key, value] of diagnostics) {
              this.diagCollection.set(vscode.Uri.file(key), value);
            }
          }
        })
      ).then(() => {
        _self.taintResults = !_self.taintResults;
        _self._onDidChangeTreeData.fire();
      });
    } else {
      vscode.window.showInformationMessage(
        "No workspace detected to load tfsecurity results from"
      );
    }
    this.taintResults = false;
  }

  getTreeItem(element: TfsecurityTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TfsecurityTreeItem): Thenable<TfsecurityTreeItem[]> {
    // if this is refresh then get the top level codes
    let items: TfsecurityTreeItem[] = [];
    if (!element) {
      items = this.getCurrentTfsecuritySeverities();
    } else if (element.treeItemType === TfsecurityTreeItemType.issueSeverity) {
      items = this.getCurrentTfsecurityIssues(element.severity);
    } else {
      items = this.getIssuesLocationsByCode(element.code);
    }
    return Promise.resolve(items);
  }

  private getCurrentTfsecuritySeverities(): TfsecurityTreeItem[] {
    var results: TfsecurityTreeItem[] = [];
    var resolvedSeverities: string[] = [];

    for (let index = 0; index < this.resultData.length; index++) {
      const result = this.resultData[index];
      if (result === undefined) {
        continue;
      }

      if (resolvedSeverities.includes(result.severity)) {
        continue;
      }
      resolvedSeverities.push(result.severity);
      results.push(
        new TfsecurityTreeItem(
          result.severity,
          new CheckSeverity(result),
          vscode.TreeItemCollapsibleState.Collapsed
        )
      );
    }
    return results.sort(sortBySeverity);
  }

  private getCurrentTfsecurityIssues(severity: string): TfsecurityTreeItem[] {
    var results: TfsecurityTreeItem[] = [];
    var resolvedCodes: string[] = [];

    for (let index = 0; index < this.resultData.length; index++) {
      const result = this.resultData[index];

      if (result === undefined) {
        continue;
      }
      if (resolvedCodes.includes(result.code) || result.severity !== severity) {
        continue;
      }
      resolvedCodes.push(result.code);
      results.push(
        new TfsecurityTreeItem(
          result.code,
          result,
          vscode.TreeItemCollapsibleState.Collapsed
        )
      );
    }
    return results.sort(sortByCode);
  }

  getIssuesLocationsByCode(code: string): TfsecurityTreeItem[] {
    var results: TfsecurityTreeItem[] = [];

    const filtered = this.resultData.filter((c) => c.code === code);
    for (let index = 0; index < filtered.length; index++) {
      const result = filtered[index];

      if (result === undefined) {
        continue;
      }
      if (result.code !== code) {
        continue;
      }
      const filename = path.relative(this.rootpath, result.filename);
      const cmd = this.createFileOpenCommand(result);
      var item = new TfsecurityTreeItem(
        `${filename}:${result.startLine}`,
        result,
        vscode.TreeItemCollapsibleState.None,
        cmd
      );
      results.push(item);
    }
    return uniqueLocations(results);
  }

  private createFileOpenCommand(result: CheckResult) {
    const issueRange = new vscode.Range(
      new vscode.Position(result.startLine - 1, 0),
      new vscode.Position(result.endLine, 0)
    );

    const pathToOpen = path.join(result.filename);

    return {
      command: "vscode.open",
      title: "",
      arguments: [
        vscode.Uri.file(pathToOpen),
        {
          selection: issueRange,
        },
      ],
    };
  }

  private processProblem(check: CheckResult): vscode.Diagnostic {
    let severity =
      check.severity === "Critical" ||
      check.severity === "High" ||
      check.severity === "Medium"
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;
    return new vscode.Diagnostic(
      new vscode.Range(
        new vscode.Position(check.startLine - 1, 0),
        new vscode.Position(check.endLine - 1, 0)
      ),
      check.summary,
      severity
    );
  }
}
