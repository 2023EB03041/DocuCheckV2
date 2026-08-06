# Draws the mock Aadhaar cards used to demonstrate the ID upload flow.
#
# These are schematic stand-ins, not imitations of a real card: flat blocks of
# colour, a placeholder where the photograph would be, obviously sequential
# numbers, and a SPECIMEN mark. They exist so the reader has something to read
# and so several guests on one booking can each upload a different document.
#
# Run from this directory:  pwsh ./make-aadhaar-specimens.ps1

Add-Type -AssemblyName System.Drawing

$W = 1000
$H = 630

# Each card that should clear the government check has to carry the one identity
# the test verification environment publishes; the rest are for reading only.
$cards = @(
    @{ File = 'aadhaar-specimen-2.png'; Name = 'Ananya Iyer';    Dob = '09-02-1992'; Sex = 'FEMALE'; Number = '2345 6789 0123' }
    @{ File = 'aadhaar-specimen-3.png'; Name = 'Vikram Rao';     Dob = '17-11-1978'; Sex = 'MALE';   Number = '3456 7890 1234' }
    @{ File = 'aadhaar-specimen-4.png'; Name = 'Meera Krishnan'; Dob = '30-06-1988'; Sex = 'FEMALE'; Number = '4567 8901 2345' }
)

$saffron = [System.Drawing.Color]::FromArgb(255, 153, 51)
$green   = [System.Drawing.Color]::FromArgb(19, 136, 8)
$ink     = [System.Drawing.Color]::FromArgb(17, 17, 17)
$muted   = [System.Drawing.Color]::FromArgb(85, 85, 85)
$slate   = [System.Drawing.Color]::FromArgb(90, 100, 120)

foreach ($card in $cards) {
    $bmp = New-Object System.Drawing.Bitmap($W, $H)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.TextRenderingHint = 'AntiAliasGridFit'
    $g.Clear([System.Drawing.Color]::White)

    $fontTitle  = New-Object System.Drawing.Font('Arial', 30, [System.Drawing.FontStyle]::Bold)
    $fontAuth   = New-Object System.Drawing.Font('Arial', 13)
    $fontName   = New-Object System.Drawing.Font('Arial', 28, [System.Drawing.FontStyle]::Bold)
    $fontDetail = New-Object System.Drawing.Font('Arial', 20)
    $fontSex    = New-Object System.Drawing.Font('Arial', 20, [System.Drawing.FontStyle]::Bold)
    $fontNumber = New-Object System.Drawing.Font('Arial', 40, [System.Drawing.FontStyle]::Bold)
    $fontMark   = New-Object System.Drawing.Font('Arial', 11)
    $fontPhoto  = New-Object System.Drawing.Font('Arial', 14)

    $centre = New-Object System.Drawing.StringFormat
    $centre.Alignment = 'Center'

    # Bands top and bottom.
    $g.FillRectangle((New-Object System.Drawing.SolidBrush($saffron)), 0, 0, $W, 78)
    $g.FillRectangle((New-Object System.Drawing.SolidBrush($green)), 0, $H - 55, $W, 55)

    $g.DrawString('GOVERNMENT OF INDIA', $fontTitle,
        [System.Drawing.Brushes]::White, ($W / 2), 18, $centre)
    $g.DrawString('UNIQUE IDENTIFICATION AUTHORITY OF INDIA', $fontAuth,
        (New-Object System.Drawing.SolidBrush($slate)), ($W / 2), 118, $centre)

    # Where a photograph would sit. Left empty on purpose.
    $g.FillRectangle([System.Drawing.Brushes]::WhiteSmoke, 55, 165, 215, 260)
    $g.DrawRectangle((New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120,120,120), 2)), 55, 165, 215, 260)
    $photoBox = New-Object System.Drawing.RectangleF(55, 280, 215, 30)
    $g.DrawString('PHOTO', $fontPhoto, (New-Object System.Drawing.SolidBrush($muted)), $photoBox, $centre)

    # Holder details.
    $inkBrush   = New-Object System.Drawing.SolidBrush($ink)
    $mutedBrush = New-Object System.Drawing.SolidBrush($muted)
    $g.DrawString($card.Name, $fontName, $inkBrush, 320, 185)
    $g.DrawString("DOB: $($card.Dob)", $fontDetail, $inkBrush, 322, 250)
    $g.DrawString($card.Sex, $fontSex, $inkBrush, 322, 305)
    $g.DrawString($card.Number, $fontNumber, $inkBrush, 312, 430)

    $g.DrawString('SPECIMEN - TEST DATA ONLY', $fontMark, $mutedBrush, 632, 548)

    $bmp.Save((Join-Path $PSScriptRoot $card.File), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    "wrote $($card.File)  -  $($card.Name), $($card.Dob), $($card.Sex)"
}
