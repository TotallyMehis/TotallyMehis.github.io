Get-ChildItem "." | Where-Object { $_.Extension -in ".tga", ".jpg", ".png" } |
Foreach-Object {
    Write-Output $_.Name

    ffmpeg.exe -y -i "$($_.Name)" -c:v libaom-av1 "$($_.BaseName).avif"
}
