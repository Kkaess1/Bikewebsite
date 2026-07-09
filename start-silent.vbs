' B-Rads Bikes — silent background startup
' This file lives in the project folder.
' Windows runs it at login via the "BradsBikes" scheduled task.
' Server output (including crash errors) is written to server.log next to this file.
Set fso      = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
scriptDir    = fso.GetParentFolderName(WScript.ScriptFullName)

' Prefer the standard Node.js install location; fall back to whatever "node" is on PATH
nodeExe = "node"
If fso.FileExists("C:\Program Files\nodejs\node.exe") Then
  nodeExe = """C:\Program Files\nodejs\node.exe"""
End If

logFile = """" & scriptDir & "\server.log" & """"
WshShell.Run "cmd /c cd /d """ & scriptDir & """ && " & nodeExe & " server.js >> " & logFile & " 2>&1", 0, False
