Add-Type -AssemblyName System.Drawing
$taskIcon = New-Object System.Drawing.Bitmap(256, 256)
$taskGraphics = [System.Drawing.Graphics]::FromImage($taskIcon)
$taskGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$taskGraphics.Clear([System.Drawing.Color]::Transparent)
$taskBackground = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#202020'))
$taskPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$taskPath.AddArc(8, 8, 104, 104, 180, 90)
$taskPath.AddArc(144, 8, 104, 104, 270, 90)
$taskPath.AddArc(144, 144, 104, 104, 0, 90)
$taskPath.AddArc(8, 144, 104, 104, 90, 90)
$taskPath.CloseFigure()
$taskGraphics.FillPath($taskBackground, $taskPath)
$taskStroke = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#e5e5e5'), 22)
$taskStroke.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$taskStroke.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$taskGraphics.DrawLine($taskStroke, 67, 64, 67, 147)
$taskGraphics.DrawArc($taskStroke, 67, 104, 86, 86, 0, 180)
$taskGraphics.DrawLine($taskStroke, 153, 64, 153, 147)
$taskStroke.Color = [System.Drawing.ColorTranslator]::FromHtml('#f5f5f5')
$taskStroke.Width = 16
$taskGraphics.DrawLine($taskStroke, 172, 188, 206, 188)
$taskDot = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#999999'))
$taskGraphics.FillEllipse($taskDot, 59, 38, 16, 16)
$taskGraphics.FillEllipse($taskDot, 145, 38, 16, 16)
$taskIcon.Save((Join-Path $PSScriptRoot '../public/uart-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$taskGraphics.Dispose()
$taskIcon.Dispose()
$taskPath.Dispose()
$taskStroke.Dispose()
$taskBackground.Dispose()
$taskDot.Dispose()
