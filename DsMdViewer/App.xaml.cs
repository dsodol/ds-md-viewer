using System;
using System.IO;
using System.IO.Pipes;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;

namespace DsMdViewer;

public partial class App : Application
{
    public static string AppName => "DS MD Viewer";
    public static string Version => "1.0.0";
    public static int BuildNumber { get; private set; }
    public static DateTime BuildDate { get; private set; }
    public static string? StartupFilePath { get; private set; }

    private const string MutexName = "DsMdViewer_SingleInstance_Mutex";
    private const string PipeName = "DsMdViewer_Pipe";
    private Mutex? _mutex;
    private CancellationTokenSource? _pipeServerCts;

    public static event Action<string>? FileOpenRequested;

    protected override void OnStartup(StartupEventArgs e)
    {
        LoadBuildInfo();

        // Capture command-line argument (file path from shell association)
        string? filePath = null;
        if (e.Args.Length > 0 && !string.IsNullOrEmpty(e.Args[0]))
        {
            filePath = e.Args[0];
        }

        // Try to acquire mutex - if we can't, another instance is running
        _mutex = new Mutex(true, MutexName, out bool createdNew);

        if (!createdNew)
        {
            // Another instance is running - send file path to it and exit
            if (!string.IsNullOrEmpty(filePath))
            {
                SendFilePathToExistingInstance(filePath);
            }
            _mutex.Dispose();
            Shutdown();
            return;
        }

        // We are the first instance
        StartupFilePath = filePath;

        // Start pipe server to listen for file paths from other instances
        StartPipeServer();

        base.OnStartup(e);
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _pipeServerCts?.Cancel();
        _mutex?.ReleaseMutex();
        _mutex?.Dispose();
        base.OnExit(e);
    }

    private void SendFilePathToExistingInstance(string filePath)
    {
        try
        {
            using var client = new NamedPipeClientStream(".", PipeName, PipeDirection.Out);
            client.Connect(1000); // 1 second timeout
            using var writer = new StreamWriter(client);
            writer.WriteLine(filePath);
            writer.Flush();
        }
        catch
        {
            // Failed to send - existing instance may not be ready
        }
    }

    private void StartPipeServer()
    {
        _pipeServerCts = new CancellationTokenSource();
        var token = _pipeServerCts.Token;

        Task.Run(async () =>
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    using var server = new NamedPipeServerStream(PipeName, PipeDirection.In);
                    await server.WaitForConnectionAsync(token);

                    using var reader = new StreamReader(server);
                    var filePath = await reader.ReadLineAsync();

                    if (!string.IsNullOrEmpty(filePath) && File.Exists(filePath))
                    {
                        Dispatcher.Invoke(() =>
                        {
                            // Bring window to front
                            if (MainWindow != null)
                            {
                                if (MainWindow.WindowState == WindowState.Minimized)
                                    MainWindow.WindowState = WindowState.Normal;
                                MainWindow.Activate();
                            }

                            FileOpenRequested?.Invoke(filePath);
                        });
                    }
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch
                {
                    // Pipe error - restart server
                    await Task.Delay(100, token);
                }
            }
        }, token);
    }

    private void LoadBuildInfo()
    {
        var buildInfoPath = Path.Combine(AppContext.BaseDirectory, "build-info.txt");
        if (File.Exists(buildInfoPath))
        {
            var lines = File.ReadAllLines(buildInfoPath);
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
