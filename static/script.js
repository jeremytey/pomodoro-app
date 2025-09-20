// Enhanced script.js - Timer with integrated task management and simplified controls

document.addEventListener("DOMContentLoaded", () => {
    let minutes = 25;
    let seconds = 0;
    let timer;
    let isRunning = false;
    let currentMode = "pomodoro";
    let completedSessions = 0;
    let currentTaskId = null;
    
    // Behavior tracking variables
    let sessionStartTime = null;
    let originalDuration = null;
    let wasSkipped = false;

    let modeDurations = Settings.durations.get();
    const sessionBeforeLong = 4;

    const minutesElement = document.getElementById("minutes");
    const secondsElement = document.getElementById("seconds");
    const startPauseBtn = document.getElementById("start-pause");
    const skipBtn = document.getElementById("skip");
    const modeButtons = document.querySelectorAll(".mode-btn");
    const sessionCountElement = document.getElementById("session-count");

    updateDisplay();

    // Initialize custom duration controls
    initializeDurationControls();

    window.addEventListener('durationsUpdated', (e) => {
        modeDurations = e.detail;
        if (!isRunning) {
            minutes = modeDurations[currentMode];
            seconds = 0;
            updateDisplay();
            startPauseBtn.textContent = "Start";
            updateButtonState("reset");
        }
    });

    // Simplified button behavior - single button logic
    startPauseBtn.addEventListener("click", () => {
        if (!isRunning) {
            startTimer();
        } else {
            pauseTimer();
        }
    });

    // Skip button behavior - always visible, different logic based on mode
    skipBtn.addEventListener("click", () => {
        if (currentMode === 'short' || currentMode === 'long') {
            // If on break, skip directly to timer tab (pomodoro mode)
            skipBreakToNextTask();
        } else {
            // If on work session, skip to next task/break
            skipToNextTask();
        }
    });

    modeButtons.forEach(button => {
        button.addEventListener("click", () => switchMode(button.dataset.mode));
    });

    // Initialize custom duration controls for all inputs
    function initializeDurationControls() {
        // Task duration input controls
        setupDurationControl('task-duration');
        
        // Settings modal duration controls
        setupDurationControl('pomodoro-length');
        setupDurationControl('short-break-length');
        setupDurationControl('long-break-length');
    }

    function setupDurationControl(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;

        const wrapper = input.closest('.custom-input-wrapper');
        if (!wrapper) return;

        const upBtn = wrapper.querySelector('.duration-up');
        const downBtn = wrapper.querySelector('.duration-down');

        if (upBtn && downBtn) {
            upBtn.addEventListener('click', () => {
                const currentValue = parseInt(input.value) || 0;
                const step = parseInt(input.step) || 1;
                const max = parseInt(input.max) || 180;
                const newValue = Math.min(currentValue + step, max);
                input.value = newValue;
                
                // Trigger change event for any listeners
                input.dispatchEvent(new Event('change', { bubbles: true }));
            });

            downBtn.addEventListener('click', () => {
                const currentValue = parseInt(input.value) || 0;
                const step = parseInt(input.step) || 1;
                const min = parseInt(input.min) || 1;
                const newValue = Math.max(currentValue - step, min);
                input.value = newValue;
                
                // Trigger change event for any listeners
                input.dispatchEvent(new Event('change', { bubbles: true }));
            });

            // Add keyboard support for up/down arrows
            input.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    upBtn.click();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    downBtn.click();
                }
            });

            // Validate input on blur
            input.addEventListener('blur', () => {
                const value = parseInt(input.value);
                const min = parseInt(input.min) || 1;
                const max = parseInt(input.max) || 180;
                
                if (isNaN(value) || value < min) {
                    input.value = min;
                } else if (value > max) {
                    input.value = max;
                }
            });
        }
    }

    function startTimer() {
        clearInterval(timer);
        if (!isRunning) {
            // Track session start
            sessionStartTime = Date.now();
            originalDuration = minutes * 60 + seconds;
            wasSkipped = false;

            // Check if we need to start the next task automatically
            if (!currentTaskId && window.taskManager) {
                currentTaskId = window.taskManager.startNextTask();
                if (currentTaskId) {
                    const task = window.taskManager.getCurrentTask(currentTaskId);
                    if (task) {
                        setTimerDuration(task.duration);
                        originalDuration = task.duration * 60;
                        if (task.type === 'break') {
                            const breakMode = task.breakType === 'long' ? 'long' : 'short';
                            switchMode(breakMode);
                        } else {
                            switchMode('pomodoro');
                        }
                    }
                }
            }

            isRunning = true;
            timer = setInterval(runTimer, 1000);
            
            // Update button states - skip button always visible
            startPauseBtn.textContent = "Pause";
            updateButtonState("running");

            window.dispatchEvent(new CustomEvent('sessionStarted', {
                detail: {
                    mode: currentMode,
                    duration: minutes * 60 + seconds,
                    taskId: currentTaskId
                }
            }));

            // Cycle study tips when session starts
            if (window.studyPlanner) {
                window.studyPlanner.cycleStudyTip();
            }
        }
    }

    function pauseTimer() {
        clearInterval(timer);
        isRunning = false;
        startPauseBtn.textContent = "Resume";
        updateButtonState("paused");

        window.dispatchEvent(new CustomEvent('sessionPaused', {
            detail: {
                mode: currentMode,
                remainingTime: minutes * 60 + seconds,
                taskId: currentTaskId
            }
        }));
    }

    // NEW FUNCTION: Fixed break skip behavior
    function skipBreakToNextTask() {
        // Mark as skipped for behavior tracking
        wasSkipped = true;
        
        // Complete the current break task if it exists
        if (currentTaskId && window.taskManager) {
            const task = window.taskManager.getCurrentTask(currentTaskId);
            if (task && task.type === 'break') {
                window.taskManager.completeTask(currentTaskId);
            }
        }
        
        clearInterval(timer);
        isRunning = false;
        
        // Emit skip event
        emitBehaviorEvent('skipped', 0);
        
        // Find and start the next work task
        if (window.taskManager) {
            const nextTask = window.taskManager.getNextTask();
            if (nextTask && nextTask.type === 'work') {
                // Start the next work task
                currentTaskId = nextTask.id;
                setTimerDuration(nextTask.duration);
                switchMode('pomodoro');
                window.taskManager.highlightCurrentTask(currentTaskId);
                startPauseBtn.textContent = "Start Task";
            } else {
                // No next work task, just switch to pomodoro mode
                currentTaskId = null;
                switchMode('pomodoro');
                startPauseBtn.textContent = "Start";
            }
        } else {
            // Fallback: switch to pomodoro mode
            currentTaskId = null;
            switchMode('pomodoro');
            startPauseBtn.textContent = "Start";
        }
        
        updateButtonState("reset");
    }

    function skipToNextTask() {
        // Mark as skipped for behavior tracking
        wasSkipped = true;
        
        if (currentTaskId && window.taskManager) {
            window.taskManager.completeTask(currentTaskId);
        }
        clearInterval(timer);
        isRunning = false;
        
        // Emit skip event with behavior data
        emitBehaviorEvent('skipped', 0);
        
        transitionToNextSession();
    }

    function runTimer() {
        if (seconds === 0) {
            if (minutes === 0) {
                clearInterval(timer);
                isRunning = false;

                playUnifiedNotificationSound();

                const currentTask = currentTaskId ? window.taskManager.getCurrentTask(currentTaskId) : null;

                if (currentTaskId && window.taskManager) {
                    window.taskManager.completeTask(currentTaskId, true);
                }

                // Calculate completion rate and emit behavior event
                const completionRate = wasSkipped ? 0 : 1.0;
                emitBehaviorEvent('completed', completionRate);

                if (currentMode === "pomodoro" && (!currentTask || currentTask.type === 'work')) {
                    completedSessions++;
                    sessionCountElement.textContent = completedSessions;
                }

                if (currentTask && currentTask.type === 'break') {
                    showBreakCompletionMessage(currentTask.name);
                }

                transitionToNextSession();
                return;
            }
            minutes--;
            seconds = 59;
        } else {
            seconds--;
        }
        updateDisplay();
    }

    // Behavior tracking event emission
    function emitBehaviorEvent(behaviorType, completionRate) {
        if (!sessionStartTime || !originalDuration) return;

        const sessionDuration = (Date.now() - sessionStartTime) / 1000;
        const actualCompletionRate = completionRate || (sessionDuration / originalDuration);
        
        const currentTask = currentTaskId ? window.taskManager.getCurrentTask(currentTaskId) : null;
        
        const behaviorData = {
            mode: currentMode,
            duration: originalDuration / 60,
            actualDuration: sessionDuration / 60,
            completionRate: actualCompletionRate,
            taskId: currentTaskId,
            taskData: currentTask ? {
                type: currentTask.type,
                category: currentTask.category || currentMode,
                subject: currentTask.subject || 'general',
                phase: currentTask.phase
            } : null,
            interruptions: 0,
            timestamp: new Date().toISOString()
        };

        // Determine specific behavior type
        let specificBehaviorType = behaviorType;
        if (behaviorType === 'completed' && !wasSkipped) {
            if (actualCompletionRate < 0.8) {
                specificBehaviorType = 'finishedEarly';
            } else if (actualCompletionRate > 1.1) {
                specificBehaviorType = 'extended';
            }
        }

        // Emit events for AI planner
        window.dispatchEvent(new CustomEvent(`session${specificBehaviorType.charAt(0).toUpperCase() + specificBehaviorType.slice(1)}`, {
            detail: behaviorData
        }));

        window.dispatchEvent(new CustomEvent('sessionComplete', {
            detail: behaviorData
        }));

        // Reset tracking variables
        sessionStartTime = null;
        originalDuration = null;
        wasSkipped = false;
    }

    function transitionToNextSession() {
        if (window.taskManager) {
            const nextTask = window.taskManager.getNextTask();

            if (nextTask) {
                currentTaskId = nextTask.id;
                setTimerDuration(nextTask.duration);

                if (nextTask.type === 'break') {
                    // Use proper break durations from settings
                    const breakMode = nextTask.breakType === 'long' ? 'long' : 'short';
                    switchMode(breakMode);
                    // Override with settings duration for breaks
                    minutes = modeDurations[breakMode];
                    seconds = 0;
                    updateDisplay();
                    startPauseBtn.textContent = `Start ${nextTask.breakType || 'Short'} Break`;
                } else {
                    switchMode('pomodoro');
                    startPauseBtn.textContent = "Start Task";
                }

                window.taskManager.highlightCurrentTask(currentTaskId);
                updateButtonState("reset");
            } else {
                // No more tasks - determine break type based on completed sessions
                currentTaskId = null;
                let breakType = 'short';
                let breakDuration = modeDurations.short;
                
                if (completedSessions > 0 && completedSessions % sessionBeforeLong === 0) {
                    breakType = 'long';
                    breakDuration = modeDurations.long;
                }
                
                switchMode(breakType);
                minutes = breakDuration;
                seconds = 0;
                updateDisplay();
                startPauseBtn.textContent = `Start ${breakType === 'long' ? 'Long' : 'Short'} Break`;
                updateButtonState("reset");
            }
        } else {
            nextMode();
        }
    }

    function setTimerDuration(duration) {
        minutes = duration || 25;
        seconds = 0;
        updateDisplay();
    }

    function updateDisplay() {
        minutesElement.textContent = minutes.toString().padStart(2, "0");
        secondsElement.textContent = seconds.toString().padStart(2, "0");

        let title = `${minutesElement.textContent}:${secondsElement.textContent}`;
        if (currentTaskId && window.taskManager) {
            const task = window.taskManager.getCurrentTask(currentTaskId);
            if (task) {
                const taskType = task.type === 'break' ? '☕ Break' : '📚 Study';
                title += ` - ${taskType}`;
            }
        }
        title += " - Pomodoro Timer";
        document.title = title;
    }

    function switchMode(mode) {
        clearInterval(timer);
        isRunning = false;
        currentMode = mode;

        if (mode === "pomodoro" && currentTaskId && window.taskManager) {
            const task = window.taskManager.getCurrentTask(currentTaskId);
            minutes = task ? task.duration : modeDurations[mode];
        } else {
            minutes = modeDurations[mode];
        }

        seconds = 0;
        updateDisplay();
        startPauseBtn.textContent = "Start";
        updateButtonState("reset");

        modeButtons.forEach(btn => btn.classList.remove("active"));
        document.querySelector(`[data-mode="${mode}"]`).classList.add("active");
    }

    function nextMode() {
        if (currentMode === "pomodoro") {
            let breakType = 'short';
            let breakDuration = modeDurations.short;
            
            if (completedSessions > 0 && completedSessions % sessionBeforeLong === 0) {
                breakType = 'long';
                breakDuration = modeDurations.long;
            }
            
            switchMode(breakType);
            minutes = breakDuration;
            seconds = 0;
            updateDisplay();
        } else {
            if (window.taskManager) {
                const nextTask = window.taskManager.getNextTask();
                if (nextTask) {
                    currentTaskId = nextTask.id;
                    if (nextTask.type === 'break') {
                        const breakMode = nextTask.breakType === 'long' ? 'long' : 'short';
                        switchMode(breakMode);
                        minutes = modeDurations[breakMode];
                        seconds = 0;
                        updateDisplay();
                    } else {
                        setTimerDuration(nextTask.duration);
                        switchMode('pomodoro');
                    }
                    window.taskManager.highlightCurrentTask(currentTaskId);
                }
            }
            if (!currentTaskId) {
                switchMode("pomodoro");
            }
        }
    }

    function updateButtonState(state) {
        startPauseBtn.classList.remove("pomodoro", "break", "paused");
        if (state === "paused") {
            startPauseBtn.classList.add("paused");
        } else if (currentMode === "pomodoro") {
            startPauseBtn.classList.add("pomodoro");
        } else {
            startPauseBtn.classList.add("break");
        }
    }

    function playUnifiedNotificationSound() {
        if (window.playNotificationSound) {
            window.playNotificationSound();
        } else if (window.playAlarm) {
            window.playAlarm();
        } else {
            console.warn("Sound system not loaded, using fallback");
            const fallbackAudio = new Audio("static/sounds/bell.mp3");
            fallbackAudio.volume = parseFloat(localStorage.getItem("volume")) || 0.5;
            fallbackAudio.play().catch(err => {
                console.warn("Sound playback failed:", err);
            });
        }
    }

    function showBreakCompletionMessage(breakName) {
        const message = document.createElement('div');
        message.className = 'break-completion-message';
        message.innerHTML = `
            <div class="completion-content">
                <span class="completion-icon">☕</span>
                <span class="completion-text">Break complete: "${breakName}"</span>
            </div>
        `;
        const timerSection = document.querySelector('.timer-section');
        if (timerSection) {
            timerSection.insertBefore(message, timerSection.firstChild);
        }
        setTimeout(() => {
            message.remove();
        }, 3000);
    }

    // Enhanced timer controls
    window.timerControls = {
        start: startTimer,
        pause: pauseTimer,
        skip: skipToNextTask,
        isRunning: () => isRunning,
        getCurrentMode: () => currentMode,
        getRemainingTime: () => minutes * 60 + seconds,
        getCurrentTask: () => currentTaskId,
        setCurrentTask: (taskId) => {
            currentTaskId = taskId;
            if (taskId && window.taskManager) {
                const task = window.taskManager.getCurrentTask(taskId);
                if (task && !isRunning) {
                    setTimerDuration(task.duration);
                    originalDuration = task.duration * 60;
                    if (task.type === 'break') {
                        const breakMode = task.breakType === 'long' ? 'long' : 'short';
                        switchMode(breakMode);
                    } else {
                        switchMode('pomodoro');
                    }
                }
            }
            updateDisplay();
        },
        setCustomDuration: setTimerDuration,
        transitionToNext: transitionToNextSession,
        getCurrentSessionData: () => ({
            startTime: sessionStartTime,
            originalDuration: originalDuration,
            currentDuration: minutes * 60 + seconds,
            wasSkipped: wasSkipped
        })
    };
});

    // Enhanced Task Manager with automatic timer integration and break management
class TaskManager {
    constructor() {
        this.tasks = [];
        this.nextId = 1;
        this.currentTaskIndex = 0;
        this.completedWorkSessions = 0; // Track work sessions for break logic
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadTasks();
        this.renderTasks();
    }

    bindEvents() {
        const taskInput = document.getElementById("task-input");
        const addTaskBtn = document.getElementById("add-task");

        if (addTaskBtn) addTaskBtn.addEventListener("click", () => this.addTaskFromInput());
        if (taskInput) {
            taskInput.addEventListener("keypress", (e) => {
                if (e.key === "Enter") this.addTaskFromInput();
            });
        }

        document.addEventListener("click", (e) => {
            if (e.target.classList.contains("task-checkbox")) {
                const taskId = parseInt(e.target.closest(".task-item").dataset.taskId);
                if (e.target.checked) {
                    this.completeTask(taskId, true);
                } else {
                    this.uncompleteTask(taskId);
                }
            }
            if (e.target.classList.contains("task-delete-btn")) {
                const taskId = parseInt(e.target.closest(".task-item").dataset.taskId);
                this.deleteTask(taskId);
            }
            if (e.target.classList.contains("task-start-btn")) {
                const taskId = parseInt(e.target.closest(".task-item").dataset.taskId);
                this.startSpecificTask(taskId);
            }
        });
    }

    addTaskFromInput() {
        const taskInput = document.getElementById("task-input");
        const taskDurationInput = document.getElementById("task-duration");
        const taskText = taskInput?.value.trim();
        const duration = parseInt(taskDurationInput?.value) || 25;
        
        if (taskText) {
            this.addTask(taskText, duration);
            taskInput.value = "";
            taskInput.focus();
        }
    }

    addTask(name, duration = 25, type = 'work', metadata = {}) {
        const task = {
            id: this.nextId++,
            name: name,
            duration: duration,
            type: type,
            breakType: metadata.breakType || null,
            phase: metadata.phase || 'main',
            category: metadata.category || 'general',
            subject: metadata.subject || 'general',
            completed: false,
            createdAt: new Date().toISOString(),
            completedAt: null,
            ...metadata
        };
        this.tasks.push(task);
        
        // Create smart break scheduling
        this.insertBreaksAutomatically();
        
        this.saveTasks();
        this.renderTasks();
        window.dispatchEvent(new CustomEvent('taskAdded', { detail: task }));
        return true;
    }

    // Auto-insert breaks based on work session count and duration
    insertBreaksAutomatically() {
        const workTasks = this.tasks.filter(t => t.type === 'work' && !t.completed);
        const breaks = this.tasks.filter(t => t.type === 'break' && !t.completed);
        
        // Remove existing auto-generated breaks to recalculate
        this.tasks = this.tasks.filter(t => t.type !== 'break' || t.manuallyAdded);
        
        const newTasks = [];
        let workSessionCount = 0;
        
        workTasks.forEach((task, index) => {
            newTasks.push(task);
            workSessionCount++;
            
            // Add break after task (except for the last task)
            if (index < workTasks.length - 1) {
                const isLongBreak = workSessionCount % 4 === 0;
                const breakTask = {
                    id: this.nextId++,
                    name: isLongBreak ? 'Long Break - Relax and recharge' : 'Short Break - Rest your mind',
                    duration: isLongBreak ? 15 : 5, // Will be overridden by settings
                    type: 'break',
                    breakType: isLongBreak ? 'long' : 'short',
                    phase: 'break',
                    category: 'break',
                    completed: false,
                    createdAt: new Date().toISOString(),
                    completedAt: null,
                    autoGenerated: true
                };
                newTasks.push(breakTask);
            }
        });
        
        // Replace tasks with new sequence
        this.tasks = [...newTasks, ...this.tasks.filter(t => t.completed)];
    }

    startSpecificTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task && !task.completed) {
            this.highlightCurrentTask(taskId);
            if (window.timerControls) {
                window.timerControls.setCurrentTask(taskId);
                // Auto-start timer when task is selected
                if (!window.timerControls.isRunning()) {
                    window.timerControls.start();
                }
            }
            return taskId;
        }
        return null;
    }

    startNextTask() {
        const availableTasks = this.tasks.filter(t => !t.completed);
        if (availableTasks.length > 0) {
            const nextTask = availableTasks[0];
            this.highlightCurrentTask(nextTask.id);
            return nextTask.id;
        }
        return null;
    }

    getNextTask() {
        const availableTasks = this.tasks.filter(t => !t.completed);
        return availableTasks.length > 0 ? availableTasks[0] : null;
    }

    getCurrentTask(taskId) {
        return this.tasks.find(t => t.id === taskId) || null;
    }

    completeTask(taskId, auto = false) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = true;
            task.completedAt = new Date().toISOString();
            
            if (task.type === 'work') {
                this.completedWorkSessions++;
            }
            
            this.saveTasks();
            this.renderTasks();
            window.dispatchEvent(new CustomEvent('taskCompleted', { detail: { task, auto } }));
        }
    }

    uncompleteTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = false;
            task.completedAt = null;
            
            if (task.type === 'work') {
                this.completedWorkSessions = Math.max(0, this.completedWorkSessions - 1);
            }
            
            this.saveTasks();
            this.renderTasks();
        }
    }

    deleteTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task && task.type === 'work') {
            // Recalculate breaks when work task is deleted
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.insertBreaksAutomatically();
        } else {
            this.tasks = this.tasks.filter(t => t.id !== taskId);
        }
        this.saveTasks();
        this.renderTasks();
    }

    highlightCurrentTask(taskId) {
        this.currentTaskIndex = this.tasks.findIndex(t => t.id === taskId);
        this.renderTasks();
    }

    saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(this.tasks));
    }

    loadTasks() {
        const saved = JSON.parse(localStorage.getItem('tasks') || '[]');
        this.tasks = saved;
        if (this.tasks.length > 0) {
            this.nextId = Math.max(...this.tasks.map(t => t.id)) + 1;
        }
        this.completedWorkSessions = this.tasks.filter(t => t.type === 'work' && t.completed).length;
    }

    renderTasks() {
        const taskList = document.getElementById("task-list");
        const emptyState = document.getElementById("empty-state");
        if (!taskList || !emptyState) return;
        
        // Show/hide empty state
        if (this.tasks.length === 0) {
            emptyState.style.display = "flex";
            taskList.style.display = "none";
        } else {
            emptyState.style.display = "none";
            taskList.style.display = "block";
        }
        
        taskList.innerHTML = "";
        this.tasks.forEach((task, index) => {
            const taskItem = document.createElement("li");
            taskItem.className = "task-item";
            taskItem.dataset.taskId = task.id;
            taskItem.dataset.duration = task.duration;
            taskItem.dataset.type = task.type;
            
            if (task.completed) taskItem.classList.add("completed");
            if (task.id === (this.tasks[this.currentTaskIndex]?.id)) taskItem.classList.add("current-task");
            if (task.type === 'break') taskItem.classList.add("break-task");

            const taskIcon = task.type === 'break' ? 
                (task.breakType === 'long' ? '☕' : '⏸') : '📖';

            taskItem.innerHTML = `
                <div class="task-content">
                    <input type="checkbox" class="task-checkbox" id="checkbox-${task.id}" ${task.completed ? 'checked' : ''}>
                    <label for="checkbox-${task.id}" class="task-name">
                        <span class="task-icon">${taskIcon}</span>
                        <span class="task-text">${task.name}</span>
                    </label>
                    <div class="task-duration-display">${task.duration} min</div>
                </div>
                <div class="task-actions">
                    <button class="task-start-btn" title="Start this task">▶</button>
                    <button class="task-delete-btn" title="Delete task">🗑</button>
                </div>
            `;
            
            // Add smooth animation for new tasks
            taskItem.style.opacity = '0';
            taskItem.style.transform = 'translateY(-10px)';
            taskList.appendChild(taskItem);
            
            // Animate in with stagger
            setTimeout(() => {
                taskItem.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                taskItem.style.opacity = '1';
                taskItem.style.transform = 'translateY(0)';
            }, index * 50);
        });
    }
}

// Initialize TaskManager
window.taskManager = new TaskManager();