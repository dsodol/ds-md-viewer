using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Markdig;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;

namespace DsMdViewer;

public partial class MainWindow : Window
{
    private readonly string _settingsPath;
    private readonly string _logFilePath;
    private Settings _settings = new();
    private readonly MarkdownPipeline _mdPipeline;
    private string? _currentFilePath;
    private readonly Dictionary<string, TabItem> _openTabs = new();
    private readonly Dictionary<string, string> _tabContents = new();
    private bool _webViewReady;

    public MainWindow()
    {
        InitializeComponent();
        var appDataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "DsMdViewer");
        _settingsPath = Path.Combine(appDataDir, "settings.json");
        _logFilePath = Path.Combine(appDataDir, "debug.log");

        // Ensure directory exists for logging
        if (!Directory.Exists(appDataDir))
            Directory.CreateDirectory(appDataDir);

        _mdPipeline = new MarkdownPipelineBuilder()
            .UseAdvancedExtensions()
            .Build();

        PreviewMouseWheel += MainWindow_PreviewMouseWheel;
    }

    private async void Window_Loaded(object sender, RoutedEventArgs e)
    {
        LoadSettings();
        UpdateVersionLabel();
        UpdateFontButtons();
        InitializeFileBrowser();

        try
        {
            await WebView.EnsureCoreWebView2Async();
            _webViewReady = true;

            // Open links in external browser
            WebView.CoreWebView2.NewWindowRequested += (s, args) =>
            {
                args.Handled = true;
                Process.Start(new ProcessStartInfo(args.Uri) { UseShellExecute = true });
            };

            WebView.CoreWebView2.NavigationStarting += async (s, args) =>
            {
                var uri = args.Uri;

                // Allow data: URLs, about:blank, and javascript: for internal navigation
                if (uri.StartsWith("data:") || uri.StartsWith("about:") || uri.StartsWith("javascript:"))
                {
                    return; // Allow these
                }

                // Handle internal anchor links (fragments within the document)
                // These appear as the full data URL with a fragment, or as relative #anchor
                if (uri.Contains("#"))
                {
                    var fragmentIndex = uri.LastIndexOf('#');
                    var fragment = uri.Substring(fragmentIndex + 1);
                    if (!string.IsNullOrEmpty(fragment))
                    {
                        args.Cancel = true;
                        try
                        {
                            await WebView.CoreWebView2.ExecuteScriptAsync(
                                $"document.getElementById('{fragment}')?.scrollIntoView({{behavior: 'smooth', block: 'start'}});");
                            Log($"Scrolled to anchor: #{fragment}");
                        }
                        catch (Exception ex)
                        {
                            Log($"Anchor scroll failed: {ex.Message}");
                        }
                        return;
                    }
                }

                // Block external navigation and open in browser
                args.Cancel = true;
                try
                {
                    Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true });
                }
                catch (Exception ex)
                {
                    Log($"Failed to open link: {ex.Message}");
                }
            };

            // Capture JavaScript console messages
            WebView.CoreWebView2.WebMessageReceived += (s, args) =>
            {
                Log($"JS: {args.WebMessageAsJson}");
            };

            Log("WebView2 initialized");

            if (!string.IsNullOrEmpty(_settings.LastOpenedFile) && File.Exists(_settings.LastOpenedFile))
            {
                OpenFile(_settings.LastOpenedFile);
            }
        }
        catch (Exception ex)
        {
            Log($"WebView2 init failed: {ex.Message}");
        }
    }

    private void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e)
    {
        // Save window state
        _settings.WindowMaximized = WindowState == WindowState.Maximized;
        if (WindowState == WindowState.Normal)
        {
            _settings.WindowLeft = Left;
            _settings.WindowTop = Top;
            _settings.WindowWidth = Width;
            _settings.WindowHeight = Height;
        }

        // Save panel sizes (only if not collapsed)
        if (!_settings.SidebarCollapsed && SidebarColumn.Width.Value > 0)
            _settings.SidebarWidth = SidebarColumn.Width.Value;
        if (!_settings.TocCollapsed && TocRow.Height.Value > 0)
            _settings.TocHeight = TocRow.Height.Value;
        if (!_settings.LogCollapsed && LogRow.Height.Value > 0)
            _settings.LogHeight = LogRow.Height.Value;

        SaveSettings();
    }

    #region Settings

    private void LoadSettings()
    {
        try
        {
            if (File.Exists(_settingsPath))
            {
                var json = File.ReadAllText(_settingsPath);
                _settings = JsonSerializer.Deserialize<Settings>(json) ?? new Settings();
                Log("Settings loaded");
            }
        }
        catch (Exception ex)
        {
            Log($"Failed to load settings: {ex.Message}");
        }

        // Restore window position and size
        if (!double.IsNaN(_settings.WindowLeft) && !double.IsNaN(_settings.WindowTop))
        {
            Left = _settings.WindowLeft;
            Top = _settings.WindowTop;
        }
        Width = _settings.WindowWidth;
        Height = _settings.WindowHeight;
        if (_settings.WindowMaximized)
            WindowState = WindowState.Maximized;

        // Restore panel sizes
        SidebarColumn.Width = new GridLength(_settings.SidebarCollapsed ? 0 : _settings.SidebarWidth);
        TocRow.Height = new GridLength(_settings.TocCollapsed ? 0 : _settings.TocHeight);
        LogRow.Height = new GridLength(_settings.LogCollapsed ? 0 : _settings.LogHeight);

        // Update collapse button states
        if (_settings.SidebarCollapsed)
            SidebarCollapseBtn.Content = "▶";
        if (_settings.TocCollapsed)
            TocCollapseBtn.Content = "▶";
        if (_settings.LogCollapsed)
            LogCollapseBtn.Content = "▶";

        // Update zoom label
        ZoomLabel.Text = $"{_settings.ZoomLevel}%";
    }

    private void SaveSettings()
    {
        try
        {
            var dir = Path.GetDirectoryName(_settingsPath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                Directory.CreateDirectory(dir);

            var json = JsonSerializer.Serialize(_settings, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(_settingsPath, json);
        }
        catch (Exception ex)
        {
            Log($"Failed to save settings: {ex.Message}");
        }
    }

    #endregion

    #region Fonts

    private void UpdateFontButtons()
    {
        BodyFontBtn.Content = FormatFontLabel(_settings.BodyFontFamily, _settings.BodyFontSize,
            _settings.BodyFontBold, _settings.BodyFontItalic);
        CodeFontBtn.Content = FormatFontLabel(_settings.CodeFontFamily, _settings.CodeFontSize,
            _settings.CodeFontBold, _settings.CodeFontItalic);
    }

    private static string FormatFontLabel(string family, float size, bool bold, bool italic)
    {
        var style = "";
        if (bold) style += "B";
        if (italic) style += "I";
        return string.IsNullOrEmpty(style)
            ? $"{family}, {size:0.#}pt"
            : $"{family}, {size:0.#}pt ({style})";
    }

    private void BodyFontBtn_Click(object sender, RoutedEventArgs e)
    {
        var style = System.Drawing.FontStyle.Regular;
        if (_settings.BodyFontBold) style |= System.Drawing.FontStyle.Bold;
        if (_settings.BodyFontItalic) style |= System.Drawing.FontStyle.Italic;

        using var dialog = new System.Windows.Forms.FontDialog
        {
            Font = new System.Drawing.Font(_settings.BodyFontFamily, _settings.BodyFontSize, style),
            ShowColor = false,
            ShowEffects = false
        };

        if (dialog.ShowDialog() == System.Windows.Forms.DialogResult.OK)
        {
            _settings.BodyFontFamily = dialog.Font.FontFamily.Name;
            _settings.BodyFontSize = dialog.Font.Size;
            _settings.BodyFontBold = dialog.Font.Bold;
            _settings.BodyFontItalic = dialog.Font.Italic;
            UpdateFontButtons();
            RefreshMarkdownDisplay();
            Log($"Body font: {FormatFontLabel(_settings.BodyFontFamily, _settings.BodyFontSize, _settings.BodyFontBold, _settings.BodyFontItalic)}");
        }
    }

    private void CodeFontBtn_Click(object sender, RoutedEventArgs e)
    {
        var style = System.Drawing.FontStyle.Regular;
        if (_settings.CodeFontBold) style |= System.Drawing.FontStyle.Bold;
        if (_settings.CodeFontItalic) style |= System.Drawing.FontStyle.Italic;

        using var dialog = new System.Windows.Forms.FontDialog
        {
            Font = new System.Drawing.Font(_settings.CodeFontFamily, _settings.CodeFontSize, style),
            ShowColor = false,
            ShowEffects = false,
            FixedPitchOnly = true
        };

        if (dialog.ShowDialog() == System.Windows.Forms.DialogResult.OK)
        {
            _settings.CodeFontFamily = dialog.Font.FontFamily.Name;
            _settings.CodeFontSize = dialog.Font.Size;
            _settings.CodeFontBold = dialog.Font.Bold;
            _settings.CodeFontItalic = dialog.Font.Italic;
            UpdateFontButtons();
            RefreshMarkdownDisplay();
            Log($"Code font: {FormatFontLabel(_settings.CodeFontFamily, _settings.CodeFontSize, _settings.CodeFontBold, _settings.CodeFontItalic)}");
        }
    }

    #endregion

    #region Zoom

    private void ZoomIn_Click(object sender, RoutedEventArgs e)
    {
        _settings.ZoomLevel = Math.Min(200, _settings.ZoomLevel + 10);
        UpdateZoom();
    }

    private void ZoomOut_Click(object sender, RoutedEventArgs e)
    {
        _settings.ZoomLevel = Math.Max(50, _settings.ZoomLevel - 10);
        UpdateZoom();
    }

    private void ZoomLabel_Click(object sender, MouseButtonEventArgs e)
    {
        _settings.ZoomLevel = 100;
        UpdateZoom();
    }

    private void MainWindow_PreviewMouseWheel(object sender, MouseWheelEventArgs e)
    {
        if (Keyboard.Modifiers == ModifierKeys.Control)
        {
            if (e.Delta > 0)
                _settings.ZoomLevel = Math.Min(200, _settings.ZoomLevel + 10);
            else
                _settings.ZoomLevel = Math.Max(50, _settings.ZoomLevel - 10);
            UpdateZoom();
            e.Handled = true;
        }
    }

    private void UpdateZoom()
    {
        ZoomLabel.Text = $"{_settings.ZoomLevel}%";
        RefreshMarkdownDisplay();
    }

    #endregion

    #region File Browser

    private void InitializeFileBrowser()
    {
        FileTree.Items.Clear();
        foreach (var drive in DriveInfo.GetDrives().Where(d => d.IsReady))
        {
            var item = CreateFileNode(drive.RootDirectory.FullName, drive.Name, true);
            FileTree.Items.Add(item);
        }

        if (!string.IsNullOrEmpty(_settings.LastExpandedPath))
        {
            ExpandToPath(_settings.LastExpandedPath);
        }

        Log("File browser initialized");
    }

    private TreeViewItem CreateFileNode(string path, string displayName, bool isDirectory)
    {
        var item = new TreeViewItem
        {
            Header = CreateFileHeader(path, displayName, isDirectory),
            Tag = path
        };

        if (isDirectory)
        {
            item.Items.Add(new TreeViewItem { Header = "Loading..." });
        }

        return item;
    }

    private StackPanel CreateFileHeader(string path, string displayName, bool isDirectory)
    {
        var panel = new StackPanel { Orientation = Orientation.Horizontal };
        var icon = new Image
        {
            Width = 16,
            Height = 16,
            Margin = new Thickness(0, 0, 4, 0),
            Source = GetFileIcon(path, isDirectory)
        };
        panel.Children.Add(icon);
        panel.Children.Add(new TextBlock { Text = displayName, VerticalAlignment = VerticalAlignment.Center });
        return panel;
    }

    private void FileTree_ItemExpanded(object sender, RoutedEventArgs e)
    {
        if (e.OriginalSource is TreeViewItem item && item.Tag is string path)
        {
            if (item.Items.Count == 1 && item.Items[0] is TreeViewItem placeholder &&
                placeholder.Header?.ToString() == "Loading...")
            {
                item.Items.Clear();
                LoadDirectoryContents(item, path);
            }
        }
    }

    private void LoadDirectoryContents(TreeViewItem parent, string path)
    {
        try
        {
            var dirs = Directory.GetDirectories(path)
                .Where(d => !IsHidden(d))
                .OrderBy(d => Path.GetFileName(d), StringComparer.OrdinalIgnoreCase);

            foreach (var dir in dirs)
            {
                var name = Path.GetFileName(dir);
                if (string.IsNullOrEmpty(name)) name = dir;
                parent.Items.Add(CreateFileNode(dir, name, true));
            }

            var files = Directory.GetFiles(path)
                .Where(f => IsMarkdownFile(f) && !IsHidden(f))
                .OrderBy(f => Path.GetFileName(f), StringComparer.OrdinalIgnoreCase);

            foreach (var file in files)
            {
                parent.Items.Add(CreateFileNode(file, Path.GetFileName(file), false));
            }
        }
        catch (UnauthorizedAccessException)
        {
            parent.Items.Add(new TreeViewItem { Header = "(Access denied)", IsEnabled = false });
        }
        catch (Exception ex)
        {
            Log($"Error loading {path}: {ex.Message}");
        }
    }

    private static bool IsHidden(string path)
    {
        var name = Path.GetFileName(path);
        if (string.IsNullOrEmpty(name)) return false;
        if (name.StartsWith('.') || name.StartsWith('$')) return true;

        try
        {
            var attrs = File.GetAttributes(path);
            return (attrs & FileAttributes.Hidden) != 0;
        }
        catch
        {
            return false;
        }
    }

    private static bool IsMarkdownFile(string path)
    {
        var ext = Path.GetExtension(path).ToLowerInvariant();
        return ext == ".md" || ext == ".markdown";
    }

    private void FileTree_SelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
    {
        if (e.NewValue is TreeViewItem item && item.Tag is string path && File.Exists(path))
        {
            OpenFile(path);
        }
    }

    private void RefreshFiles_Click(object sender, RoutedEventArgs e)
    {
        InitializeFileBrowser();
    }

    private void SyncToFile_Click(object sender, RoutedEventArgs e)
    {
        if (!string.IsNullOrEmpty(_currentFilePath))
        {
            ExpandToPath(_currentFilePath);
        }
    }

    private void ExpandToPath(string targetPath)
    {
        var parts = targetPath.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            .Where(p => !string.IsNullOrEmpty(p)).ToList();

        if (parts.Count == 0) return;

        var drivePart = parts[0] + "\\";
        TreeViewItem? current = null;

        foreach (TreeViewItem driveItem in FileTree.Items)
        {
            if (driveItem.Tag is string drivePath &&
                drivePath.Equals(drivePart, StringComparison.OrdinalIgnoreCase))
            {
                current = driveItem;
                current.IsExpanded = true;
                break;
            }
        }

        if (current == null) return;

        for (int i = 1; i < parts.Count; i++)
        {
            var partPath = string.Join("\\", parts.Take(i + 1));
            if (i == 1) partPath = drivePart + parts[1];

            TreeViewItem? found = null;
            foreach (TreeViewItem child in current.Items)
            {
                if (child.Tag is string childPath &&
                    childPath.Equals(partPath, StringComparison.OrdinalIgnoreCase))
                {
                    found = child;
                    break;
                }
            }

            if (found != null)
            {
                found.IsExpanded = true;
                current = found;
            }
            else
            {
                break;
            }
        }

        current.IsSelected = true;
        current.BringIntoView();
    }

    #endregion

    #region Shell Icons

    [DllImport("shell32.dll", CharSet = CharSet.Auto)]
    private static extern IntPtr SHGetFileInfo(string pszPath, uint dwFileAttributes,
        ref SHFILEINFO psfi, uint cbFileInfo, uint uFlags);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool DestroyIcon(IntPtr hIcon);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private struct SHFILEINFO
    {
        public IntPtr hIcon;
        public int iIcon;
        public uint dwAttributes;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
        public string szDisplayName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)]
        public string szTypeName;
    }

    private const uint SHGFI_ICON = 0x100;
    private const uint SHGFI_SMALLICON = 0x1;
    private const uint SHGFI_USEFILEATTRIBUTES = 0x10;
    private const uint FILE_ATTRIBUTE_DIRECTORY = 0x10;
    private const uint FILE_ATTRIBUTE_NORMAL = 0x80;

    private static ImageSource? GetFileIcon(string path, bool isDirectory)
    {
        var shfi = new SHFILEINFO();
        uint flags = SHGFI_ICON | SHGFI_SMALLICON;
        uint attrs = isDirectory ? FILE_ATTRIBUTE_DIRECTORY : FILE_ATTRIBUTE_NORMAL;

        if (!Path.Exists(path))
            flags |= SHGFI_USEFILEATTRIBUTES;

        var result = SHGetFileInfo(path, attrs, ref shfi, (uint)Marshal.SizeOf(shfi), flags);
        if (result == IntPtr.Zero || shfi.hIcon == IntPtr.Zero)
            return null;

        try
        {
            var source = Imaging.CreateBitmapSourceFromHIcon(
                shfi.hIcon, Int32Rect.Empty, BitmapSizeOptions.FromEmptyOptions());
            source.Freeze();
            return source;
        }
        finally
        {
            DestroyIcon(shfi.hIcon);
        }
    }

    #endregion

    #region Tabs

    private void OpenFile(string filePath)
    {
        if (_openTabs.TryGetValue(filePath, out var existingTab))
        {
            TabBar.SelectedItem = existingTab;
            ReloadFileContent(filePath);
            return;
        }

        try
        {
            var content = File.ReadAllText(filePath);
            _tabContents[filePath] = content;

            var tab = new TabItem
            {
                Tag = filePath,
                ToolTip = filePath
            };

            var header = new StackPanel { Orientation = Orientation.Horizontal };
            header.Children.Add(new TextBlock { Text = Path.GetFileName(filePath), VerticalAlignment = VerticalAlignment.Center });
            var closeBtn = new Button
            {
                Content = "×",
                Padding = new Thickness(4, 0, 4, 0),
                Margin = new Thickness(8, 0, 0, 0),
                Background = Brushes.Transparent,
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand
            };
            closeBtn.Click += (s, e) => CloseTab(filePath);
            header.Children.Add(closeBtn);
            tab.Header = header;

            _openTabs[filePath] = tab;
            TabBar.Items.Add(tab);
            TabBar.SelectedItem = tab;

            _settings.LastOpenedFile = filePath;
            _settings.LastExpandedPath = Path.GetDirectoryName(filePath) ?? "";

            Log($"Opened: {Path.GetFileName(filePath)}");
        }
        catch (Exception ex)
        {
            Log($"Error opening file: {ex.Message}");
        }
    }

    private void CloseTab(string filePath)
    {
        if (_openTabs.TryGetValue(filePath, out var tab))
        {
            var index = TabBar.Items.IndexOf(tab);
            TabBar.Items.Remove(tab);
            _openTabs.Remove(filePath);
            _tabContents.Remove(filePath);

            if (TabBar.Items.Count > 0)
            {
                var newIndex = Math.Min(index, TabBar.Items.Count - 1);
                TabBar.SelectedIndex = newIndex;
            }
            else
            {
                _currentFilePath = null;
                DisplayMarkdown("");
                UpdateTitle(null);
                UpdateToc(new List<TocEntry>());
            }
        }
    }

    private void TabBar_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (TabBar.SelectedItem is TabItem tab && tab.Tag is string filePath)
        {
            _currentFilePath = filePath;
            if (_tabContents.TryGetValue(filePath, out var content))
            {
                DisplayMarkdown(content);
                UpdateTitle(filePath);
                UpdateTocFromMarkdown(content);
            }
        }
    }

    private void ReloadFileContent(string filePath)
    {
        try
        {
            var content = File.ReadAllText(filePath);
            _tabContents[filePath] = content;
            if (_currentFilePath == filePath)
            {
                DisplayMarkdown(content);
                UpdateTocFromMarkdown(content);
            }
            Log($"Reloaded: {Path.GetFileName(filePath)}");
        }
        catch (Exception ex)
        {
            Log($"Error reloading: {ex.Message}");
        }
    }

    private void RefreshContent_Click(object sender, RoutedEventArgs e)
    {
        if (!string.IsNullOrEmpty(_currentFilePath))
        {
            ReloadFileContent(_currentFilePath);
        }
    }

    #endregion

    #region Markdown Rendering

    private void DisplayMarkdown(string markdown)
    {
        if (!_webViewReady) return;

        var html = Markdown.ToHtml(markdown, _mdPipeline);
        var fullHtml = WrapInHtml(html);
        WebView.NavigateToString(fullHtml);
    }

    private void RefreshMarkdownDisplay()
    {
        if (!string.IsNullOrEmpty(_currentFilePath) && _tabContents.TryGetValue(_currentFilePath, out var content))
        {
            DisplayMarkdown(content);
        }
    }

    private string WrapInHtml(string bodyHtml)
    {
        var zoom = _settings.ZoomLevel / 100.0;
        var bodyFontSizePx = _settings.BodyFontSize * 1.333 * zoom; // pt to px approx
        var codeFontSizePx = _settings.CodeFontSize * 1.333 * zoom;
        var bodyWeight = _settings.BodyFontBold ? "bold" : "normal";
        var bodyStyle = _settings.BodyFontItalic ? "italic" : "normal";
        var codeWeight = _settings.CodeFontBold ? "bold" : "normal";
        var codeStyle = _settings.CodeFontItalic ? "italic" : "normal";

        return $@"<!DOCTYPE html>
<html>
<head>
    <meta charset=""utf-8"">
    <style>
        body {{
            font-family: '{_settings.BodyFontFamily}', sans-serif;
            font-size: {bodyFontSizePx:0.#}px;
            font-weight: {bodyWeight};
            font-style: {bodyStyle};
            line-height: 1.6;
            padding: 20px;
            max-width: 900px;
            margin: 0 auto;
            color: #1a1a1a;
        }}
        h1, h2, h3, h4, h5, h6 {{
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            font-weight: 600;
        }}
        h1 {{ font-size: 2em; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.3em; }}
        h2 {{ font-size: 1.5em; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.3em; }}
        h3 {{ font-size: 1.25em; }}
        code {{
            font-family: '{_settings.CodeFontFamily}', monospace;
            font-size: {codeFontSizePx:0.#}px;
            font-weight: {codeWeight};
            font-style: {codeStyle};
            background: #f5f5f5;
            padding: 0.2em 0.4em;
            border-radius: 3px;
        }}
        pre {{
            background: #f5f5f5;
            padding: 16px;
            overflow-x: auto;
            border-radius: 6px;
        }}
        pre code {{
            background: none;
            padding: 0;
        }}
        blockquote {{
            margin: 0;
            padding-left: 1em;
            border-left: 4px solid #e0e0e0;
            color: #666;
        }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
        }}
        th, td {{
            border: 1px solid #e0e0e0;
            padding: 8px 12px;
            text-align: left;
        }}
        th {{
            background: #f5f5f5;
            font-weight: 600;
        }}
        a {{
            color: #0066cc;
            text-decoration: none;
        }}
        a:hover {{
            text-decoration: underline;
        }}
        img {{
            max-width: 100%;
            height: auto;
        }}
        ul, ol {{
            padding-left: 2em;
        }}
        li {{
            margin: 0.25em 0;
        }}
        hr {{
            border: none;
            border-top: 1px solid #e0e0e0;
            margin: 2em 0;
        }}
        input[type=""checkbox""] {{
            margin-right: 0.5em;
        }}
        /* Syntax highlighting */
        .hljs-keyword, .hljs-selector-tag, .hljs-built_in {{ color: #0000ff; }}
        .hljs-string, .hljs-attribute {{ color: #a31515; }}
        .hljs-comment {{ color: #008000; }}
        .hljs-number {{ color: #098658; }}
        .hljs-function {{ color: #795e26; }}
        .hljs-title {{ color: #267f99; }}
        .hljs-params {{ color: #001080; }}
    </style>
    <link rel=""stylesheet"" href=""https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css"">
    <script src=""https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js""></script>
</head>
<body>
{bodyHtml}
<script>
hljs.highlightAll();
document.body.onclick = function(e) {{
    var link = e.target.closest('a');
    if (link) {{
        var href = link.getAttribute('href');
        if (href && href.charAt(0) === '#') {{
            e.preventDefault();
            var targetId = href.slice(1);
            window.chrome.webview.postMessage('clicked: #' + targetId);
            var targetEl = document.getElementById(targetId);
            if (!targetEl) {{
                var idx = targetId.indexOf('-');
                while (idx > 0 && !targetEl) {{
                    var stripped = targetId.slice(idx + 1);
                    window.chrome.webview.postMessage('trying: ' + stripped);
                    targetEl = document.getElementById(stripped);
                    idx = targetId.indexOf('-', idx + 1);
                }}
            }}
            window.chrome.webview.postMessage('found: ' + (targetEl ? 'yes' : 'no'));
            if (targetEl) {{
                targetEl.scrollIntoView({{behavior: 'smooth', block: 'start'}});
            }}
            return false;
        }}
    }}
}};
</script>
</body>
</html>";
    }

    #endregion

    #region Table of Contents

    private record TocEntry(int Level, string Text, string Id);

    private void UpdateTocFromMarkdown(string markdown)
    {
        // Convert markdown to HTML to get the actual IDs Markdig generates
        var html = Markdown.ToHtml(markdown, _mdPipeline);
        var entries = new List<TocEntry>();

        // Parse heading tags with their IDs from the HTML
        var headingRegex = new System.Text.RegularExpressions.Regex(
            @"<h([1-6])\s+id=""([^""]+)""[^>]*>([^<]*)</h\1>",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        foreach (System.Text.RegularExpressions.Match match in headingRegex.Matches(html))
        {
            var level = int.Parse(match.Groups[1].Value);
            var id = match.Groups[2].Value;
            var text = System.Net.WebUtility.HtmlDecode(match.Groups[3].Value.Trim());

            if (!string.IsNullOrEmpty(text))
            {
                entries.Add(new TocEntry(level, text, id));
            }
        }

        UpdateToc(entries);
    }

    private void UpdateToc(List<TocEntry> entries)
    {
        TocTree.Items.Clear();

        foreach (var entry in entries)
        {
            var item = new TreeViewItem
            {
                Header = entry.Text,
                Tag = entry.Id,
                Margin = new Thickness((entry.Level - 1) * 12, 0, 0, 0)
            };
            TocTree.Items.Add(item);
        }
    }

    private async void TocTree_SelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
    {
        if (_webViewReady && e.NewValue is TreeViewItem item && item.Tag is string id)
        {
            try
            {
                await WebView.CoreWebView2.ExecuteScriptAsync(
                    $"document.getElementById('{id}')?.scrollIntoView({{behavior: 'smooth', block: 'start'}});");
            }
            catch { }
        }
    }

    private void ToggleToc_Click(object sender, RoutedEventArgs e)
    {
        if (TocRow.Height.Value > 0)
        {
            _settings.TocHeight = TocRow.Height.Value;
            TocRow.Height = new GridLength(0);
            TocCollapseBtn.Content = "▶";
            _settings.TocCollapsed = true;
        }
        else
        {
            TocRow.Height = new GridLength(_settings.TocHeight > 0 ? _settings.TocHeight : 200);
            TocCollapseBtn.Content = "▼";
            _settings.TocCollapsed = false;
        }
    }

    #endregion

    #region Log Panel

    private void Log(string message)
    {
        var timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
        var entry = $"[{timestamp}] {message}";

        // Write to file
        try
        {
            File.AppendAllText(_logFilePath, entry + Environment.NewLine);
        }
        catch { }

        // Write to UI
        Dispatcher.Invoke(() =>
        {
            LogList.Items.Add(entry);
            LogList.ScrollIntoView(entry);
        });
    }

    private void ClearLog_Click(object sender, RoutedEventArgs e)
    {
        LogList.Items.Clear();
    }

    private void ToggleLog_Click(object sender, RoutedEventArgs e)
    {
        if (LogRow.Height.Value > 0)
        {
            _settings.LogHeight = LogRow.Height.Value;
            LogRow.Height = new GridLength(0);
            LogCollapseBtn.Content = "▶";
            _settings.LogCollapsed = true;
        }
        else
        {
            LogRow.Height = new GridLength(_settings.LogHeight > 0 ? _settings.LogHeight : 150);
            LogCollapseBtn.Content = "▼";
            _settings.LogCollapsed = false;
        }
    }

    private void ToggleSidebar_Click(object sender, RoutedEventArgs e)
    {
        if (SidebarColumn.Width.Value > 0)
        {
            _settings.SidebarWidth = SidebarColumn.Width.Value;
            SidebarColumn.Width = new GridLength(0);
            SidebarCollapseBtn.Content = "▶";
            _settings.SidebarCollapsed = true;
        }
        else
        {
            SidebarColumn.Width = new GridLength(_settings.SidebarWidth > 0 ? _settings.SidebarWidth : 250);
            SidebarCollapseBtn.Content = "◀";
            _settings.SidebarCollapsed = false;
        }
    }

    #endregion

    #region Misc

    private void UpdateVersionLabel()
    {
        var buildDate = App.BuildDate.ToString("yyyy-MM-dd HH:mm");
        VersionLabel.Text = $"v{App.Version} (build {App.BuildNumber}) - {buildDate}";
    }

    private void UpdateTitle(string? filePath)
    {
        Title = string.IsNullOrEmpty(filePath)
            ? App.AppName
            : $"{Path.GetFileName(filePath)} - {App.AppName}";
    }

    #endregion

    #region Menu and Keyboard

    private void Window_KeyDown(object sender, KeyEventArgs e)
    {
        if (Keyboard.Modifiers == ModifierKeys.Control)
        {
            if (e.Key == Key.O)
            {
                if (Keyboard.Modifiers.HasFlag(ModifierKeys.Shift))
                    OpenFolder_Click(sender, e);
                else
                    OpenFile_Click(sender, e);
                e.Handled = true;
            }
        }
    }

    private void OpenFile_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFileDialog
        {
            Filter = "Markdown files (*.md;*.markdown)|*.md;*.markdown|All files (*.*)|*.*",
            Title = "Open Markdown File"
        };

        if (dialog.ShowDialog() == true)
        {
            OpenFile(dialog.FileName);
            Log($"Opened via dialog: {Path.GetFileName(dialog.FileName)}");
        }
    }

    private void OpenFolder_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new System.Windows.Forms.FolderBrowserDialog
        {
            Description = "Select folder to browse",
            UseDescriptionForTitle = true
        };

        if (dialog.ShowDialog() == System.Windows.Forms.DialogResult.OK)
        {
            _settings.LastExpandedPath = dialog.SelectedPath;
            ExpandToPath(dialog.SelectedPath);
            Log($"Opened folder: {dialog.SelectedPath}");
        }
    }

    private void Exit_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private void ZoomReset_Click(object sender, RoutedEventArgs e)
    {
        _settings.ZoomLevel = 100;
        UpdateZoom();
    }

    #endregion
}

public class Settings
{
    public string BodyFontFamily { get; set; } = "Segoe UI";
    public float BodyFontSize { get; set; } = 11f;
    public bool BodyFontBold { get; set; } = false;
    public bool BodyFontItalic { get; set; } = false;

    public string CodeFontFamily { get; set; } = "Consolas";
    public float CodeFontSize { get; set; } = 10f;
    public bool CodeFontBold { get; set; } = false;
    public bool CodeFontItalic { get; set; } = false;

    public int ZoomLevel { get; set; } = 100;
    public string? LastOpenedFile { get; set; }
    public string? LastExpandedPath { get; set; }
    public double SidebarWidth { get; set; } = 250;
    public double TocHeight { get; set; } = 200;
    public double LogHeight { get; set; } = 150;
    public bool SidebarCollapsed { get; set; } = false;
    public bool TocCollapsed { get; set; } = false;
    public bool LogCollapsed { get; set; } = false;
    public double WindowLeft { get; set; } = double.NaN;
    public double WindowTop { get; set; } = double.NaN;
    public double WindowWidth { get; set; } = 1200;
    public double WindowHeight { get; set; } = 800;
    public bool WindowMaximized { get; set; } = false;
}
