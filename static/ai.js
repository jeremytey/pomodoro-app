/**
 * Enhanced AI Study Planner - Simple & Student-Focused
 * Updated Features:
 * - Cycling study tips instead of welcome message
 * - Improved session planning with proper time allocation
 * - Better "Read + Take Notes" frequency
 * - Optimized warmup duration (10 min)
 */

class StudyPlanner {
    constructor() {
        this.currentPlan = null;
        this.cache = new Map();
        this.isGenerating = false;
        this.currentTipIndex = 0;
        
        // Simple session tracking
        this.sessionData = {
            focusHistory: this.loadFocusHistory(),
            totalSessions: 0
        };
        
        // Study categories with optimal durations
        this.categories = {
            study: { 
                icon: '📖', 
                name: 'Study Session',
                duration: 45,
                keywords: ['read', 'chapter', 'textbook', 'learn', 'understand', 'study', 'material', 'notes']
            },
            review: { 
                icon: '🔄', 
                name: 'Review & Practice',
                duration: 30,
                keywords: ['review', 'revise', 'recall', 'test', 'exam', 'quiz', 'practice', 'remember']
            },
            assignment: { 
                icon: '📋', 
                name: 'Assignment Work',
                duration: 50,
                keywords: ['write', 'essay', 'project', 'assignment', 'homework', 'solve', 'complete', 'create']
            }
        };

        // Study tips for cycling display
        this.studyTips = [
            "Take notes by hand for better retention",
            "Use the Feynman Technique: explain concepts simply", 
            "Take breaks to let your brain consolidate information",
            "Study in a distraction-free environment",
            "Review material within 24 hours for best recall",
            "Break complex topics into smaller chunks",
            "Use active recall instead of just re-reading",
            "Practice spaced repetition for long-term memory",
            "Test yourself frequently while studying",
            "Stay hydrated and take care of your body"
        ];

        this.init();
    }

    init() {
        this.bindEvents();
        this.setupStudyTipsBlock();
        this.setupTaskTimeSelector();
        this.startTipCycling();
    }

    bindEvents() {
        const generateBtn = document.getElementById("generate-plan-btn");
        const goalInput = document.getElementById("ai-goal-input");
        
        generateBtn?.addEventListener("click", () => this.generatePlan());
        goalInput?.addEventListener("keypress", (e) => {
            if (e.key === "Enter" && !this.isGenerating) this.generatePlan();
        });

        // Session length buttons
        document.querySelectorAll(".session-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".session-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
            });
        });

        // AI task integration
        document.addEventListener("click", (e) => {
            if (e.target.classList.contains("add-to-tasks-btn")) {
                this.addSingleTask(e.target.closest(".ai-task-item"));
            }
            if (e.target.classList.contains("add-all-tasks-btn")) {
                this.addAllTasks();
            }
        });

        // Listen for session events to cycle tips
        window.addEventListener('sessionStarted', () => this.cycleStudyTip());
        window.addEventListener('sessionComplete', () => this.cycleStudyTip());
    }

    // Setup cycling study tips block (replacing welcome message)
    setupStudyTipsBlock() {
        const tipsBlock = document.getElementById("study-tips-block");
        if (!tipsBlock) return;

        // Already set up in HTML, just ensure it's visible
        this.updateStudyTip();
    }

    // Start automatic tip cycling every 3 minutes
    startTipCycling() {
        setInterval(() => {
            this.cycleStudyTip();
        }, 3 * 60 * 1000); // 3 minutes
    }

    // Cycle to next study tip
    cycleStudyTip() {
        this.currentTipIndex = (this.currentTipIndex + 1) % this.studyTips.length;
        this.updateStudyTip();
    }

    // Update the displayed study tip
    updateStudyTip() {
        const tipText = document.getElementById("current-tip");
        if (tipText) {
            const newTip = this.studyTips[this.currentTipIndex];
            
            // Add fade effect
            tipText.style.opacity = '0.5';
            setTimeout(() => {
                tipText.textContent = newTip;
                tipText.style.opacity = '1';
            }, 300);
        }
    }

    // Setup task time selector functionality
    setupTaskTimeSelector() {
        const durationSelector = document.getElementById("task-duration");
        const customInput = document.getElementById("custom-duration");
        const taskInput = document.getElementById("task-input");
        const addTaskBtn = document.getElementById("add-task");

        if (!durationSelector || !addTaskBtn) return;

        // Handle duration selector change
        durationSelector.addEventListener("change", (e) => {
            if (e.target.value === "custom") {
                customInput.classList.remove("hidden");
                customInput.focus();
            } else {
                customInput.classList.add("hidden");
            }
        });

        // Handle task addition with custom duration
        addTaskBtn.addEventListener("click", () => this.addCustomTask());
        taskInput?.addEventListener("keypress", (e) => {
            if (e.key === "Enter") this.addCustomTask();
        });
    }

    // Add task with custom duration
    addCustomTask() {
        const taskInput = document.getElementById("task-input");
        const durationSelector = document.getElementById("task-duration");
        const customInput = document.getElementById("custom-duration");
        
        const taskName = taskInput?.value.trim();
        if (!taskName) {
            this.showMessage("Please enter a task name", "warning");
            return;
        }

        let duration = parseInt(durationSelector.value);
        if (durationSelector.value === "custom") {
            duration = parseInt(customInput.value) || 25;
        }

        // Add task directly to the task list
        this.addTaskToList(taskName, duration);
        
        // Clear inputs
        taskInput.value = "";
        customInput.value = "";
        customInput.classList.add("hidden");
        durationSelector.value = "25";
        this.showMessage(`✅ "${taskName}" added (${duration} min)!`, "success");
    }

    // Add task to task manager
    addTaskToList(name, duration, type = 'work') {
        if (window.taskManager) {
            window.taskManager.addTask(name, duration, type);
        }
    }

    // Get session length from UI
    getSessionLength() {
        const activeBtn = document.querySelector('.session-btn.active');
        return activeBtn ? activeBtn.dataset.length : 'medium';
    }

    async generatePlan() {
        const goalInput = document.getElementById("ai-goal-input");
        const goal = goalInput?.value.trim();
        
        if (!goal || goal.length < 3) {
            this.showMessage("💡 Please describe your study goal (e.g., 'review calculus chapter 5')", "info");
            goalInput?.focus();
            return;
        }

        if (this.isGenerating) return;

        // Check cache first
        const sessionLength = this.getSessionLength();
        const cacheKey = `${goal}-${sessionLength}`;
        
        if (this.cache.has(cacheKey)) {
            this.displayPlan(this.cache.get(cacheKey));
            this.showMessage("⚡ Smart plan loaded!", "success");
            return;
        }

        this.setLoadingState(true);
        this.isGenerating = true;

        try {
            // Generate local plan
            const analysis = this.analyzeGoal(goal);
            const plan = this.generateStudyPlan(analysis, sessionLength);
            
            this.cache.set(cacheKey, plan);
            this.currentPlan = plan;
            this.displayPlan(plan);
            
            goalInput.value = "";
            
        } catch (error) {
            console.error("Plan generation error:", error);
            this.showMessage("🔧 Generated offline plan", "info");
            
        } finally {
            this.setLoadingState(false);
            this.isGenerating = false;
        }
    }

    analyzeGoal(goal) {
        const goalLower = goal.toLowerCase();
        
        // Find best matching category
        let bestCategory = 'study';
        let bestScore = 0;
        
        Object.entries(this.categories).forEach(([category, config]) => {
            const score = config.keywords.reduce((sum, keyword) => {
                return sum + (goalLower.includes(keyword) ? 1 : 0);
            }, 0);
            
            if (score > bestScore) {
                bestScore = score;
                bestCategory = category;
            }
        });
        
        // Detect subject for better planning
        const subjects = {
            'math': ['math', 'calculus', 'algebra', 'statistics', 'geometry'],
            'science': ['physics', 'chemistry', 'biology', 'lab'],
            'language': ['english', 'literature', 'writing', 'essay'],
            'history': ['history', 'historical', 'timeline'],
            'programming': ['code', 'programming', 'python', 'javascript']
        };
        
        let subject = 'general';
        Object.entries(subjects).forEach(([subj, keywords]) => {
            if (keywords.some(keyword => goalLower.includes(keyword))) {
                subject = subj;
            }
        });

        return {
            category: bestCategory,
            subject: subject,
            confidence: bestScore,
            difficulty: this.estimateDifficulty(goalLower)
        };
    }

    estimateDifficulty(goalLower) {
        const hardKeywords = ['complex', 'difficult', 'advanced', 'comprehensive'];
        const easyKeywords = ['basic', 'simple', 'introduction', 'overview'];
        
        if (hardKeywords.some(word => goalLower.includes(word))) return 'hard';
        if (easyKeywords.some(word => goalLower.includes(word))) return 'easy';
        return 'medium';
    }

    generateStudyPlan(analysis, sessionLength) {
        const category = this.categories[analysis.category];
        const baseDuration = category.duration;
        
        // Updated session patterns with better time allocation
        const sessionPatterns = {
            short: { // 1h = 60 min
                pattern: ['warmup', 'main'],
                targetTime: 60
            },
            medium: { // 2-4h = 180-240 min
                pattern: ['warmup', 'main', 'deep', 'review'],
                targetTime: 180
            },
            long: { // 6h = 360 min
                pattern: ['warmup', 'main', 'deep', 'main2', 'deep2', 'review'],
                targetTime: 360
            }
        };

        const sessionConfig = sessionPatterns[sessionLength] || sessionPatterns.medium;
        const pattern = sessionConfig.pattern;
        const targetTime = sessionConfig.targetTime;
        
        const tasks = [];
        let taskId = 1;

        // Calculate work time (70% of total time for work, 30% for breaks)
        const workTime = Math.floor(targetTime * 0.7);
        const avgWorkDuration = Math.floor(workTime / pattern.length);

        // Generate work sessions with proper "Read + Take Notes" frequency
        pattern.forEach((phase, index) => {
            const duration = this.getPhaseDuration(phase, avgWorkDuration, analysis.difficulty, sessionLength);
            const taskName = this.getTaskName(phase, analysis, sessionLength);
            
            tasks.push({
                id: taskId++,
                name: taskName,
                duration: duration,
                type: 'work',
                phase: phase,
                category: analysis.category,
                icon: category.icon
            });

            // Add breaks between sessions (but not after the last one)
            if (index < pattern.length - 1) {
                const breakDuration = this.getBreakDuration(index, pattern.length, sessionLength);
                
                tasks.push({
                    id: taskId++,
                    name: this.getBreakActivity(breakDuration),
                    duration: breakDuration,
                    type: 'break',
                    phase: 'break',
                    icon: '☕'
                });
            }
        });

        const totalTime = tasks.reduce((sum, task) => sum + task.duration, 0);
        const workTasks = tasks.filter(t => t.type === 'work').length;

        return {
            success: true,
            plan: tasks,
            analysis: analysis,
            category: analysis.category,
            totalTime: totalTime,
            taskCount: workTasks,
            motivation: this.getMotivation(analysis.category)
        };
    }

    getPhaseDuration(phase, avgDuration, difficulty, sessionLength) {
        // Updated phase multipliers
        const multipliers = {
            warmup: 0.4, // Reduced from 0.3 to accommodate 10-minute warmup
            main: 1.0,
            main2: 1.0, // For long sessions
            deep: 1.3,
            deep2: 1.2, // Slightly less intense second deep phase
            review: 0.7
        };
        
        let duration = Math.round(avgDuration * multipliers[phase]);
        
        // Ensure warmup is exactly 10 minutes for medium/long sessions
        if (phase === 'warmup' && sessionLength !== 'short') {
            duration = 10;
        }
        
        // Adjust for difficulty
        if (difficulty === 'hard') duration = Math.round(duration * 1.1);
        if (difficulty === 'easy') duration = Math.round(duration * 0.9);
        
        return Math.max(10, Math.min(60, duration));
    }

    getBreakDuration(index, totalPhases, sessionLength) {
        // Better break allocation
        if (sessionLength === 'long') {
            // Longer break in the middle of long sessions
            return (index === Math.floor(totalPhases / 2)) ? 15 : 10;
        } else if (sessionLength === 'medium') {
            return (index === Math.floor(totalPhases / 2)) ? 10 : 5;
        } else {
            return 5;
        }
    }

    getTaskName(phase, analysis, sessionLength) {
        // Enhanced templates with better "Read + Take Notes" frequency
        const templates = {
            study: {
                warmup: 'Preview and organize materials',
                main: 'Read and take detailed notes',
                main2: 'Read and take detailed notes (continued)',
                deep: 'Analyze and summarize key concepts',
                deep2: 'Practice problems and application',
                review: 'Review and consolidate learning'
            },
            review: {
                warmup: 'Quick review of previous notes',
                main: 'Active recall and practice questions',
                main2: 'Active recall and practice questions (round 2)',
                deep: 'Test understanding with difficult problems',
                deep2: 'Review mistakes and gaps',
                review: 'Final review and self-assessment'
            },
            assignment: {
                warmup: 'Plan structure and gather resources',
                main: 'Work on main content sections',
                main2: 'Continue writing main content',
                deep: 'Refine arguments and add details',
                deep2: 'Edit and improve quality',
                review: 'Final review and polish'
            }
        };
        
        return templates[analysis.category][phase] || 'Focus work session';
    }

    getBreakActivity(duration) {
        const activities = duration >= 10 
            ? ['Take a walk outside', 'Light stretching', 'Healthy snack break', 'Fresh air and hydration']
            : ['Stretch and breathe', 'Rest your eyes', 'Quick walk', 'Hydrate'];
        
        return activities[Math.floor(Math.random() * activities.length)];
    }

    getMotivation(category) {
        const motivations = {
            study: ['Ready to learn! 📚', 'Focus time! 🎯', 'Knowledge awaits! ✨'],
            review: ['Practice makes perfect! 💪', 'Recall power! 🧠', 'Review mode! 🔄'],
            assignment: ['Creation time! 🚀', 'Building progress! 📈', 'Making it happen! ⚡']
        };
        
        const options = motivations[category] || motivations.study;
        return options[Math.floor(Math.random() * options.length)];
    }

    displayPlan(plan) {
        this.updatePlanHeader(plan);
        this.displayTaskList(plan);
        
        const resultsWrapper = document.getElementById("ai-plan-results");
        resultsWrapper?.classList.remove("hidden");
        
        this.showMessage(`🎯 Smart plan ready! ${plan.motivation}`, "success");
    }

    updatePlanHeader(plan) {
        const { category, totalTime, taskCount } = plan;
        const categoryInfo = this.categories[category];
        
        const planStats = document.querySelector('.plan-stats');
        if (planStats) {
            planStats.innerHTML = `
                <div class="plan-overview">
                    <div class="category-badge" style="background: ${this.getCategoryColor(category)}">
                        <span class="category-icon">${categoryInfo.icon}</span>
                        <span class="category-name">${categoryInfo.name}</span>
                    </div>
                    <div class="plan-meta">
                        <span class="meta-item">⏱️ ${totalTime} min total</span>
                        <span class="meta-separator">•</span>
                        <span class="meta-item">📋 ${taskCount} work blocks</span>
                        ${plan.analysis.subject !== 'general' ? `
                            <span class="meta-separator">•</span>
                            <span class="meta-item">📚 ${plan.analysis.subject}</span>
                        ` : ''}
                    </div>
                </div>
            `;
        }
    }

    getCategoryColor(category) {
        const colors = {
            study: '#3498db',
            review: '#e74c3c', 
            assignment: '#27ae60'
        };
        return colors[category] || '#3498db';
    }

    displayTaskList(plan) {
        const taskList = document.getElementById("ai-task-list");
        if (!taskList) return;

        taskList.innerHTML = `
            <div class="tasks-header">
                <h6>📋 Your Study Flow</h6>
                <button class="add-all-tasks-btn">➕ Add All to Timer</button>
            </div>
            <ul class="ai-task-list">
                ${plan.plan.map((task, index) => this.createTaskHTML(task, index)).join('')}
            </ul>
        `;
    }

    createTaskHTML(task, index) {
        const isBreak = task.type === 'break';
        
        return `
            <li class="ai-task-item ${task.type}" data-task-id="${task.id}">
                <div class="task-header">
                    <div class="task-meta">
                        <span class="task-icon">${task.icon}</span>
                        <span class="task-number">#${index + 1}</span>
                        <span class="task-duration">${task.duration}min</span>
                        <span class="task-phase">
                            ${isBreak ? 'break' : task.phase}
                        </span>
                    </div>
                    <button class="add-to-tasks-btn">+</button>
                </div>
                <div class="task-content">
                    <div class="task-name">${task.name}</div>
                </div>
            </li>
        `;
    }

    addSingleTask(taskElement) {
        const taskId = taskElement.dataset.taskId;
        const task = this.currentPlan?.plan.find(t => t.id == taskId);
        
        if (!task) return;
        
        // Add to task list
        this.addTaskToList(task.name, task.duration, task.type);
        this.markTaskAsAdded(taskElement);
        this.showMessage(`✅ "${task.name}" added!`, "success");
    }

    addAllTasks() {
        if (!this.currentPlan?.plan) return;
        
        let addedCount = 0;
        this.currentPlan.plan.forEach(task => {
            this.addTaskToList(task.name, task.duration, task.type);
            addedCount++;
        });
        
        if (addedCount > 0) {
            this.showMessage(`🚀 Added complete session (${addedCount} items)!`, "success");
            
            document.querySelectorAll(".ai-task-item").forEach(item => {
                this.markTaskAsAdded(item);
            });
        }
    }

    markTaskAsAdded(taskElement) {
        taskElement.classList.add("task-added");
        const button = taskElement.querySelector(".add-to-tasks-btn");
        if (button) {
            button.textContent = "✓";
            button.disabled = true;
            button.style.background = "#27ae60";
            button.style.color = "white";
        }
    }

    // --- Local storage handling ---
    loadFocusHistory() {
        try {
            const data = localStorage.getItem("focusHistory");
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.warn("Failed to load focus history:", e);
            return [];
        }
    }

    saveFocusHistory(history) {
        try {
            localStorage.setItem("focusHistory", JSON.stringify(history));
        } catch (e) {
            console.warn("Failed to save focus history:", e);
        }
    }

    // --- UI Helpers ---
    setLoadingState(isLoading) {
        const generateBtn = document.getElementById("generate-plan-btn");
        if (!generateBtn) return;
        if (isLoading) {
            generateBtn.disabled = true;
            generateBtn.textContent = "⏳ Generating...";
        } else {
            generateBtn.disabled = false;
            generateBtn.textContent = "✨ Generate Plan";
        }
    }

    showMessage(message, type = "info") {
        // Check if messages container exists, if not create it
        let container = document.getElementById("ai-messages");
        if (!container) {
            container = document.createElement("div");
            container.id = "ai-messages";
            container.style.position = "fixed";
            container.style.top = "20px";
            container.style.right = "20px";
            container.style.zIndex = "9999";
            document.body.appendChild(container);
        }

        const msg = document.createElement("div");
        msg.className = `ai-message ${type}`;
        msg.textContent = message;

        container.appendChild(msg);

        setTimeout(() => {
            msg.classList.add("fade-out");
            setTimeout(() => msg.remove(), 500);
        }, 3500);
    }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    window.studyPlanner = new StudyPlanner();
});