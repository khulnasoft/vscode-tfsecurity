import * as vscode from "vscode";
import {
  ignoreAllInstances,
  ignoreInstance,
  ingorePath,
  triggerDecoration,
} from "./ignore";
import { TfsecurityIssueProvider } from "./explorer/issues_treeview";
import { TfsecurityTreeItem } from "./explorer/tfsecurity_treeitem";
import { TfsecurityHelpProvider } from "./explorer/check_helpview";

import { extname } from "path";
import { TfsecurityWrapper } from "./tfsecurity_wrapper";

// this method is called when vs code is activated
export function activate(context: vscode.ExtensionContext) {
  let activeEditor = vscode.window.activeTextEditor;
  var outputChannel = vscode.window.createOutputChannel("tfsecurity");
  let diagCollection = vscode.languages.createDiagnosticCollection();

  const helpProvider = new TfsecurityHelpProvider();
  const issueProvider = new TfsecurityIssueProvider(context, diagCollection);
  const tfsecurityWrapper = new TfsecurityWrapper(
    outputChannel,
    issueProvider.resultsStoragePath
  );

  // creating the issue tree explicitly to allow access to events
  let issueTree = vscode.window.createTreeView("tfsecurity.issueview", {
    treeDataProvider: issueProvider,
  });

  issueTree.onDidChangeSelection(function (event) {
    const treeItem = event.selection[0];
    if (treeItem) {
      helpProvider.update(treeItem);
    }
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("tfsecurity.helpview", helpProvider)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("tfsecurity.refresh", () =>
      issueProvider.refresh()
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("tfsecurity.version", () =>
      tfsecurityWrapper.showCurrentTfsecurityVersion()
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("tfsecurity.ignore", (element: TfsecurityTreeItem) =>
      ignoreInstance(element, outputChannel)
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tfsecurity.ignoreAll",
      (element: TfsecurityTreeItem) =>
        ignoreAllInstances(element, issueProvider, outputChannel)
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tfsecurity.ignoreSeverity",
      (element: TfsecurityTreeItem) =>
        ignoreAllInstances(element, issueProvider, outputChannel)
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("tfsecurity.run", () => tfsecurityWrapper.run())
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("tfsecurity.updatebinary", () =>
      tfsecurityWrapper.updateBinary()
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("tfsecurity.ignorePath", (element: any) =>
      ingorePath(element)
    )
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        // only act if this is a terraform file
        if (editor && extname(editor.document.fileName) !== ".tf") {
          return;
        }
        activeEditor = editor;
        triggerDecoration();
      },
      null,
      context.subscriptions
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(
      (event) => {
        // only act if this is a terraform file
        if (extname(event.document.fileName) !== ".tf") {
          return;
        }
        if (activeEditor && event.document === activeEditor.document) {
          triggerDecoration();
        }
      },
      null,
      context.subscriptions
    )
  );

  if (activeEditor && extname(activeEditor.document.fileName) !== ".tf") {
    triggerDecoration();
  }
}
