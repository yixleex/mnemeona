use std::{
    env,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
};

struct ImageService {
    child: Mutex<Option<Child>>,
}

impl ImageService {
    fn new() -> Self {
        Self {
            child: Mutex::new(None),
        }
    }

    fn start(&self) {
        let mut child_guard = match self.child.lock() {
            Ok(guard) => guard,
            Err(error) => {
                eprintln!("[mnemeona-image] Failed to lock service state: {error}");
                return;
            }
        };

        // Don't start another copy if one is already running.
        if let Some(child) = child_guard.as_mut() {
            match child.try_wait() {
                Ok(None) => {
                    println!("[mnemeona-image] Image service is already running.");
                    return;
                }
                Ok(Some(status)) => {
                    println!(
                        "[mnemeona-image] Previous image service exited with status: {status}"
                    );
                }
                Err(error) => {
                    eprintln!("[mnemeona-image] Could not check previous image service: {error}");
                }
            }

            *child_guard = None;
        }

        let Some(service_dir) = find_image_service_dir() else {
            eprintln!(
                "[mnemeona-image] Could not find the mnemeona-image directory. \
                 Image generation will remain unavailable."
            );
            return;
        };

        println!(
            "[mnemeona-image] Found image service at: {}",
            service_dir.display()
        );

        let mut command = match image_service_command(&service_dir) {
            Ok(command) => command,
            Err(error) => {
                eprintln!("[mnemeona-image] {error}");
                return;
            }
        };

        let child = match command
            .current_dir(&service_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .spawn()
        {
            Ok(child) => child,
            Err(error) => {
                eprintln!("[mnemeona-image] Failed to start image service: {error}");
                return;
            }
        };

        println!(
            "[mnemeona-image] Image service started with PID {}.",
            child.id()
        );

        *child_guard = Some(child);
    }

    fn stop(&self) {
        let mut child_guard = match self.child.lock() {
            Ok(guard) => guard,
            Err(error) => {
                eprintln!("[mnemeona-image] Failed to lock service state: {error}");
                return;
            }
        };

        let Some(mut child) = child_guard.take() else {
            return;
        };

        println!(
            "[mnemeona-image] Stopping image service (PID {}).",
            child.id()
        );

        match child.try_wait() {
            Ok(Some(status)) => {
                println!("[mnemeona-image] Image service had already exited with status: {status}");
            }

            Ok(None) => {
                if let Err(error) = child.kill() {
                    eprintln!("[mnemeona-image] Failed to stop image service: {error}");
                }

                if let Err(error) = child.wait() {
                    eprintln!("[mnemeona-image] Failed waiting for image service to exit: {error}");
                }
            }

            Err(error) => {
                eprintln!(
                    "[mnemeona-image] Could not check image service before stopping: {error}"
                );

                let _ = child.kill();
                let _ = child.wait();
            }
        }

        println!("[mnemeona-image] Image service stopped.");
    }
}

/// Search upward from a starting directory for:
///
///     mnemeona-image/
///
/// This handles both:
///
///     Mnemeona/
///     Mnemeona/tauri/
///
/// as the current working directory.
fn find_image_service_from(start: &Path) -> Option<PathBuf> {
    let mut current = start.to_path_buf();

    loop {
        let candidate = current.join("mnemeona-image");

        if is_image_service_dir(&candidate) {
            return Some(candidate);
        }

        if !current.pop() {
            break;
        }
    }

    None
}

fn find_image_service_dir() -> Option<PathBuf> {
    // 1. Search upward from the current working directory.
    if let Ok(current_dir) = env::current_dir() {
        println!(
            "[mnemeona-image] Searching from current directory: {}",
            current_dir.display()
        );

        if let Some(path) = find_image_service_from(&current_dir) {
            return Some(path);
        }
    }

    // 2. Search upward from the executable location.
    if let Ok(executable) = env::current_exe() {
        if let Some(executable_dir) = executable.parent() {
            println!(
                "[mnemeona-image] Searching from executable directory: {}",
                executable_dir.display()
            );

            if let Some(path) = find_image_service_from(executable_dir) {
                return Some(path);
            }
        }
    }

    None
}

fn is_image_service_dir(path: &Path) -> bool {
    if !path.is_dir() {
        return false;
    }

    // app.py is the identifying file for the image service.
    path.join("app.py").is_file()
}

fn image_service_command(service_dir: &Path) -> Result<Command, String> {
    #[cfg(target_os = "windows")]
    {
        let python = service_dir.join("venv").join("Scripts").join("python.exe");

        if !python.is_file() {
            return Err(format!(
                "Could not find the image service Python executable at: {}",
                python.display()
            ));
        }

        let mut command = Command::new(python);

        command.args([
            "-m",
            "uvicorn",
            "app:app",
            "--host",
            "127.0.0.1",
            "--port",
            "8000",
        ]);

        Ok(command)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let python = service_dir.join("venv").join("bin").join("python");

        if !python.is_file() {
            return Err(format!(
                "Could not find the image service Python executable at: {}",
                python.display()
            ));
        }

        let mut command = Command::new(python);

        command.args([
            "-m",
            "uvicorn",
            "app:app",
            "--host",
            "127.0.0.1",
            "--port",
            "8000",
        ]);

        Ok(command)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let image_service = Arc::new(ImageService::new());

    // Start the image service before launching the Tauri application.
    //
    // Failure is deliberately non-fatal: Mnemeona itself should still open
    // even if the image service isn't installed or can't start.
    image_service.start();

    let image_service_for_exit = Arc::clone(&image_service);

    tauri::Builder::default()
        .setup(|_app| {
            println!("[mnemeona-image] Image service startup requested.");
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Mnemeona")
        .run(move |_app_handle, event| match event {
            tauri::RunEvent::ExitRequested { .. } => {
                image_service_for_exit.stop();
            }

            tauri::RunEvent::Exit => {
                image_service_for_exit.stop();
            }

            _ => {}
        });
}
