using System;
using System.Windows;

namespace DsMdViewer;

public partial class App : Application
{
    public static string AppName => "DS MD Viewer";
    public static string Version => "1.0.0";
    public static int BuildNumber { get; private set; }
    public static DateTime BuildDate { get; private set; }

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        LoadBuildInfo();
    }

    private void LoadBuildInfo()
    {
        var buildInfoPath = System.IO.Path.Combine(AppContext.BaseDirectory, "build-info.txt");
        if (System.IO.File.Exists(buildInfoPath))
        {
            var lines = System.IO.File.ReadAllLines(buildInfoPath);
            if (lines.Length >= 2)
            {
                int.TryParse(lines[0], out int buildNum);
                BuildNumber = buildNum;
                DateTime.TryParse(lines[1], out DateTime buildDate);
                BuildDate = buildDate;
            }
        }
        else
        {
            BuildNumber = 1;
            BuildDate = DateTime.Now;
        }
    }
}
