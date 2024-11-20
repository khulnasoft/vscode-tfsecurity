# tfsecurity

This VS Code extension is for [tfsecurity](https://khulnasoft.github.io/tfsecurity/latest). A static analysis security scanner for your Terraform code that discovers problems with your infrastructure before hackers do.

## Features

### Findings Explorer

The Findings Explorer displays an an organised view the issues that have been found in the current workspace.

The code runs tfsecurity in a VS Code integrated terminal so you can see the the output - when it is complete, press the refresh button to reload.

Right clicking on an tfsecurity code will let you view the associated page on [https://khulnasoft.github.io/tfsecurity/latest](https://khulnasoft.github.io/tfsecurity/latest)

Issues can be ignored by right clicking the location in the explorer and selecting `ignore this issue`.

### Ignoring filepaths

In the Explorer view, you can right click on a folder or .tf file and select `Ignore path during tfsecurity runs`. This will pass the path to `--exclude-path` when running tfsecurity and is only applicable to this workspace on this machine.

To remove ignores, edit the `tfsecurity.excludedPath` in the `.vscode/settings.json` file of the current workspace.

#### See Change log for more information
