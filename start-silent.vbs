' B-Rads Bikes — silent background startup
' This file lives in the project folder.
' Windows runs it at login via a shortcut in the Startup folder.
Set fso      = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
scriptDir    = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "cmd /c cd /d """ & scriptDir & """ && node server.js", 0, False
