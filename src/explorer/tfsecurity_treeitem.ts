import * as vscode from "vscode";
import * as path from "path";
import { CheckResult, CheckSeverity } from "./check_result";

export class TfsecurityTreeItem extends vscode.TreeItem {
  treeItemType: TfsecurityTreeItemType;
  code: string;
  provider: string;
  startLineNumber: number;
  endLineNumber: number;
  filename: string;
  severity: string;
  contextValue = "";

  constructor(
    public readonly title: string,
    public readonly check: CheckResult | CheckSeverity,
    public collapsibleState: vscode.TreeItemCollapsibleState,
    public command?: vscode.Command
  ) {
    super(title, collapsibleState);
    this.severity = check.severity;
    this.code = "";
    this.provider = "";
    this.startLineNumber = 0;
    this.endLineNumber = 0;
    this.filename = "";

    if (check instanceof CheckResult) {
      this.code = check.code;
      this.provider = check.provider;
      if (collapsibleState === vscode.TreeItemCollapsibleState.None) {
        this.treeItemType = TfsecurityTreeItemType.issueLocation;
        this.contextValue = "TFSECURITY_FILE_LOCATION";
        this.startLineNumber = check.startLine;
        this.endLineNumber = check.endLine;
        this.filename = check.filename;
        this.iconPath = vscode.ThemeIcon.File;
        this.resourceUri = vscode.Uri.parse(check.filename);
      } else {
        this.treeItemType = TfsecurityTreeItemType.issueCode;
        this.contextValue = "TFSECURITY_CODE";
        this.tooltip = `${check.codeDescription}`;
        this.iconPath = {
          light: path.join(
            __filename,
            "..",
            "..",
            "resources",
            "light",
            "tfsecurity.svg"
          ),
          dark: path.join(
            __filename,
            "..",
            "..",
            "resources",
            "dark",
            "tfsecurity.svg"
          ),
        };
      }
    } else {
      this.treeItemType = TfsecurityTreeItemType.issueSeverity;
      this.contextValue = "TFSECURITY_SEVERITY";
      this.iconPath = {
        light: path.join(
          __filename,
          "..",
          "..",
          "resources",
          this.severityIcon(this.severity)
        ),
        dark: path.join(
          __filename,
          "..",
          "..",
          "resources",
          this.severityIcon(this.severity)
        ),
      };
    }
  }

  severityIcon = (severity: string): string => {
    switch (severity) {
      case "Critical":
        return "critical.svg";
      case "High":
        return "high.svg";
      case "Medium":
        return "medium.svg";
      case "Low":
        return "low.svg";
    }
    return "unknown.svg";
  };
}

export enum TfsecurityTreeItemType {
  issueCode = 0,
  issueLocation = 1,
  issueSeverity = 2,
}
