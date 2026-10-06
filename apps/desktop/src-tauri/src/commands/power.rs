use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

/// Whether the autopilot is holding the machine awake.
static KEEP_AWAKE: AtomicBool = AtomicBool::new(false);

const ES_CONTINUOUS: u32 = 0x8000_0000;
const ES_SYSTEM_REQUIRED: u32 = 0x0000_0001;

#[cfg(windows)]
extern "system" {
    fn SetThreadExecutionState(flags: u32) -> u32;
}

#[cfg(windows)]
fn apply_awake(on: bool) {
    let flags = if on { ES_CONTINUOUS | ES_SYSTEM_REQUIRED } else { ES_CONTINUOUS };
    // SAFETY: plain Win32 call with a flag value; no pointers involved
    unsafe {
        SetThreadExecutionState(flags);
    }
}

#[cfg(not(windows))]
fn apply_awake(_on: bool) {}

/// Stops Windows from sleeping while the autopilot runs. Only idle sleep is blocked: closing the lid
/// still sleeps unless the lid action is set to "Do nothing" in Windows power settings.
#[tauri::command]
pub fn power_keep_awake(enabled: bool) -> Result<(), String> {
    let was_on = KEEP_AWAKE.swap(enabled, Ordering::SeqCst);
    if enabled && !was_on {
        // The execution state applies to one thread, so a dedicated thread keeps re-asserting it
        std::thread::spawn(|| {
            while KEEP_AWAKE.load(Ordering::SeqCst) {
                apply_awake(true);
                std::thread::sleep(Duration::from_secs(30));
            }
            apply_awake(false);
        });
    }
    Ok(())
}
