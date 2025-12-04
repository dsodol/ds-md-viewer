using System.Collections.ObjectModel;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace DsMdViewer;

public partial class MainWindow : Window
{
    private static readonly string SettingsPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "DsMdViewer", "settings.txt");

    public ObservableCollection<FileNode> Nodes { get; } = new();
    public ObservableCollection<string> Log { get; } = new();

    public event EventHandler<string>? FileSelected;

    public MainWindow()
    {
        InitializeComponent();
        DataContext = this;

        Log.Add("Starting...");
        foreach (var drive in DriveInfo.GetDrives().Where(d => d.IsReady))
        {
            Nodes.Add(new FileNode(drive.Name, drive.RootDirectory.FullName, true));
        }
        Log.Add($"Found {Nodes.Count} drives");

        var lastPath = LoadLastPath();
        if (!string.IsNullOrEmpty(lastPath))
        {
            Log.Add($"Restoring: {lastPath}");
            ExpandToPath(lastPath);
        }

        FileSelected += (_, path) =>
        {
            Log.Add($"Selected: {path}");
            SaveLastPath(path);
        };
    }

    private void FileTree_SelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
    {
        if (e.NewValue is FileNode node)
        {
            SaveLastPath(node.Path);
            if (!node.IsDirectory)
                FileSelected?.Invoke(this, node.Path);
        }
    }

    private void TreeViewItem_Expanded(object sender, RoutedEventArgs e)
    {
        if (e.OriginalSource is TreeViewItem { DataContext: FileNode node } && node.Children.Count == 0)
            node.LoadChildren();
    }

    private void ExpandToPath(string path)
    {
        var parts = path.Split(Path.DirectorySeparatorChar, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return;

        var driveName = parts[0] + Path.DirectorySeparatorChar;
        var driveNode = Nodes.FirstOrDefault(n => n.Path.Equals(driveName, StringComparison.OrdinalIgnoreCase));
        if (driveNode == null) return;

        var current = driveNode;
        current.LoadChildren();
        current.IsExpanded = true;

        for (int i = 1; i < parts.Length; i++)
        {
            var child = current.Children.FirstOrDefault(c =>
                c.Name.Equals(parts[i], StringComparison.OrdinalIgnoreCase));
            if (child == null) break;

            if (child.IsDirectory)
            {
                child.LoadChildren();
                child.IsExpanded = true;
            }
            current = child;
        }

        current.IsSelected = true;
    }

    private static string? LoadLastPath()
    {
        try { return File.Exists(SettingsPath) ? File.ReadAllText(SettingsPath).Trim() : null; }
        catch { return null; }
    }

    private static void SaveLastPath(string path)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(SettingsPath)!);
            File.WriteAllText(SettingsPath, path);
        }
        catch { }
    }
}

public class FileNode : INotifyPropertyChanged
{
    public string Name { get; }
    public string Path { get; }
    public bool IsDirectory { get; }
    public ObservableCollection<FileNode> Children { get; } = new();
    public ImageSource? Icon => ShellIcon.GetIcon(Path, IsDirectory);

    private bool _isExpanded;
    public bool IsExpanded
    {
        get => _isExpanded;
        set { _isExpanded = value; PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(IsExpanded))); }
    }

    private bool _isSelected;
    public bool IsSelected
    {
        get => _isSelected;
        set { _isSelected = value; PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(IsSelected))); }
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    public FileNode(string name, string path, bool isDirectory)
    {
        Name = name;
        Path = path;
        IsDirectory = isDirectory;
    }

    public void LoadChildren()
    {
        try
        {
            foreach (var dir in Directory.GetDirectories(Path).OrderBy(d => System.IO.Path.GetFileName(d)))
                Children.Add(new FileNode(System.IO.Path.GetFileName(dir), dir, true));
            foreach (var file in Directory.GetFiles(Path).OrderBy(f => System.IO.Path.GetFileName(f)))
                Children.Add(new FileNode(System.IO.Path.GetFileName(file), file, false));
        }
        catch { }
    }
}

public static class ShellIcon
{
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr SHGetFileInfo(string pszPath, uint dwFileAttributes, ref SHFILEINFO psfi, uint cbSizeFileInfo, uint uFlags);

    [DllImport("user32.dll")]
    private static extern bool DestroyIcon(IntPtr hIcon);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
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

    public static ImageSource? GetIcon(string path, bool isDirectory)
    {
        var shfi = new SHFILEINFO();
        var result = SHGetFileInfo(path, 0, ref shfi, (uint)Marshal.SizeOf(shfi), SHGFI_ICON | SHGFI_SMALLICON);
        if (result == IntPtr.Zero || shfi.hIcon == IntPtr.Zero)
            return null;

        try
        {
            return Imaging.CreateBitmapSourceFromHIcon(shfi.hIcon, Int32Rect.Empty, BitmapSizeOptions.FromEmptyOptions());
        }
        finally
        {
            DestroyIcon(shfi.hIcon);
        }
    }
}
