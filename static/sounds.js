// Enhanced sounds.js - Unified notification system 
// Sound collection with correct paths
const sounds = {
    bell: new Audio("static/sounds/bell.mp3"),
    alarm: new Audio("static/sounds/alarm.mp3"),
    chime: new Audio("static/sounds/chime.mp3")
};

// Preload sounds
Object.values(sounds).forEach(sound => {
    sound.load();
    // Enable playing when page not in focus
    sound.preload = 'auto';
});

// Set alarm sound
function setAlarmSound(soundKey) {
    if (sounds[soundKey]) {
        localStorage.setItem("alarmSound", soundKey);
        
        // Optional: support Settings if available
        if (window.Settings?.sound?.save) {
            Settings.sound.save(soundKey);
        }
        
        console.log(`Notification sound set to: ${soundKey}`);
    }
}

// MAIN FUNCTION: Play notification sound for ANY session ending
function playNotificationSound() {
    const selectedSound = getSelectedSound();
    const audio = sounds[selectedSound];
    
    if (!audio) {
        console.warn(`Sound "${selectedSound}" not found, using default`);
        return playNotificationSound("bell");
    }

    // Reset audio to beginning
    audio.currentTime = 0;
    
    // Handle autoplay restrictions gracefully
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
        playPromise
            .then(() => {
                console.log(`✅ Notification sound "${selectedSound}" played successfully`);
            })
            .catch(err => {
                console.warn("🔇 Sound playback blocked by browser:", err);
                // Try to show visual notification instead
                showVisualNotification("Session Complete! 🔔");
            });
    }
}

// Get currently selected sound with fallbacks
function getSelectedSound() {
    return (
        (window.Settings?.sound?.get && Settings.sound.get()) ||
        localStorage.getItem("alarmSound") ||
        "bell" // Default fallback
    );
}

// Visual fallback when sound is blocked
function showVisualNotification(message) {
    // Create temporary notification element
    const notification = document.createElement('div');
    notification.className = 'audio-blocked-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--accent-color);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        font-weight: bold;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2700);
}

// Backward compatibility - keep old function name but use unified system
function playAlarm() {
    playNotificationSound();
}

// Volume control (enhanced to work with page not in focus)
document.addEventListener("DOMContentLoaded", () => {
    const volume = parseFloat(localStorage.getItem("volume")) || 0.5;
    
    // Set volume for all sounds
    Object.values(sounds).forEach(sound => {
        sound.volume = volume;
        // Allow playing in background/unfocused state
        sound.setAttribute('preload', 'auto');
    });

    const volumeSlider = document.getElementById("volume-slider");
    if (volumeSlider) {
        volumeSlider.value = volume * 100;
        volumeSlider.addEventListener("input", (e) => {
            const newVolume = e.target.value / 100;
            Object.values(sounds).forEach(sound => {
                sound.volume = newVolume;
            });
            localStorage.setItem("volume", newVolume);
            
            // Test sound when adjusting volume
            if (newVolume > 0) {
                playNotificationSound();
            }
        });
    }
});

// CSS for visual notification (inject into document)
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    .audio-blocked-notification {
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
`;
document.head.appendChild(style);

// Export for global use
window.playNotificationSound = playNotificationSound;
window.setAlarmSound = setAlarmSound;