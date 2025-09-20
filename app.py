import os
import json
import logging
from datetime import datetime
from flask import Flask, request, jsonify, render_template
import google.generativeai as genai
from dotenv import load_dotenv
from functools import lru_cache
import time

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Gemini with error handling
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")
model = None

if GOOGLE_API_KEY:
    try:
        genai.configure(api_key=GOOGLE_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")
        logger.info("✅ Gemini AI initialized successfully")
    except Exception as e:
        logger.warning(f"⚠️ Gemini initialization failed: {e}")
        model = None
else:
    logger.warning("⚠️ GEMINI_API_KEY not found - AI features will use fallbacks")

app = Flask(__name__)

class SimplifiedStudyPlanner:
    """
    Streamlined AI Study Planner - Performance First
    
    Key improvements:
    1. Single AI call per request (motivation only)
    2. Smart caching with LRU
    3. Local analysis for categorization
    4. Graceful AI fallbacks
    5. Reduced code complexity
    """
    
    def __init__(self):
        self.session_history = []
        self.motivation_cache = {}
        self.cache_expiry = 3600  # 1 hour cache
        
        # Simplified core categories
        self.categories = {
            'study': {
                'icon': '📖',
                'name': 'Study Session',
                'focus_time': 45,
                'break_time': 10,
                'keywords': ['read', 'chapter', 'textbook', 'book', 'learn', 'understand', 'study', 'material']
            },
            'revision': {
                'icon': '🔄', 
                'name': 'Review & Practice',
                'focus_time': 30,
                'break_time': 5,
                'keywords': ['review', 'revise', 'recall', 'test', 'exam', 'quiz', 'practice', 'remember', 'memorize']
            },
            'assignment': {
                'icon': '📋',
                'name': 'Assignment Work', 
                'focus_time': 50,
                'break_time': 15,
                'keywords': ['write', 'essay', 'project', 'assignment', 'homework', 'solve', 'complete', 'create', 'build']
            }
        }
        
        # Session patterns (unchanged - they work well)
        self.session_patterns = {
            'short': ['warmup', 'main'],
            'medium': ['warmup', 'main', 'deep'],  
            'long': ['warmup', 'main', 'main', 'deep']
        }

    def analyze_goal_smart(self, goal):
        """Fast local analysis with enhanced keyword matching"""
        goal_lower = goal.lower()
        
        # Score each category
        category_scores = {}
        for category, config in self.categories.items():
            # Count keyword matches
            score = sum(1 for keyword in config['keywords'] if keyword in goal_lower)
            
            # Bonus for exact matches
            if any(keyword == word for keyword in config['keywords'] for word in goal_lower.split()):
                score += 2
                
            if score > 0:
                category_scores[category] = score
        
        # Default to study if no clear match
        detected_category = max(category_scores, key=category_scores.get) if category_scores else 'study'
        confidence = category_scores.get(detected_category, 0)
        
        # Enhanced subject detection
        subject = self._detect_subject_enhanced(goal_lower)
        
        # Difficulty estimation
        difficulty = self._estimate_difficulty(goal_lower)
        
        return {
            'category': detected_category,
            'subject': subject,
            'confidence': confidence,
            'difficulty': difficulty,
            'goal_length': len(goal.split())
        }

    def _detect_subject_enhanced(self, goal):
        """Enhanced subject detection"""
        subjects = {
            'mathematics': ['math', 'calculus', 'algebra', 'statistics', 'geometry', 'trigonometry', 'equations'],
            'science': ['physics', 'chemistry', 'biology', 'lab', 'experiment', 'scientific', 'molecules'],
            'language': ['english', 'literature', 'writing', 'essay', 'grammar', 'reading', 'composition'],
            'history': ['history', 'historical', 'timeline', 'events', 'civilization', 'war', 'ancient'],
            'programming': ['code', 'programming', 'python', 'javascript', 'algorithm', 'software', 'development'],
            'business': ['business', 'economics', 'finance', 'marketing', 'management', 'accounting'],
            'art': ['art', 'design', 'drawing', 'painting', 'creative', 'visual', 'aesthetic']
        }
        
        for subject, keywords in subjects.items():
            if any(keyword in goal for keyword in keywords):
                return subject
        return 'general'

    def _estimate_difficulty(self, goal_lower):
        """Estimate task difficulty from goal description"""
        hard_indicators = ['advanced', 'complex', 'difficult', 'comprehensive', 'detailed', 'analyze', 'synthesize']
        easy_indicators = ['basic', 'simple', 'introduction', 'overview', 'quick', 'summary', 'skim']
        
        hard_score = sum(1 for word in hard_indicators if word in goal_lower)
        easy_score = sum(1 for word in easy_indicators if word in goal_lower)
        
        if hard_score > easy_score:
            return 'challenging'
        elif easy_score > hard_score:
            return 'manageable'
        return 'moderate'

    def generate_base_plan(self, analysis, session_length, focus_history=None):
        """Generate plan structure locally (no AI needed)"""
        category = analysis['category']
        config = self.categories[category]
        
        # Adaptive timing based on focus history
        adjusted_config = self._adjust_timings(config, focus_history)
        
        pattern = self.session_patterns[session_length]
        tasks = []
        task_id = 1
        
        # Generate tasks based on pattern
        for i, phase in enumerate(pattern):
            # Work task
            duration = self._get_phase_duration(phase, adjusted_config['focus_time'], analysis['difficulty'])
            task_name = self._get_phase_task_name(phase, analysis)
            
            tasks.append({
                'id': task_id,
                'name': task_name,
                'duration': duration,
                'type': 'work',
                'phase': phase,
                'category': category,
                'icon': config['icon']
            })
            task_id += 1
            
            # Add break (except after last task)
            if i < len(pattern) - 1:
                break_duration = adjusted_config['break_time']
                if i == len(pattern) - 2 and len(pattern) > 2:  # Longer break before final task
                    break_duration += 5
                    
                break_type = 'long' if break_duration >= 15 else 'short'
                break_activity = self._get_smart_break_activity(break_type, i, analysis['category'])
                
                tasks.append({
                    'id': task_id,
                    'name': break_activity,
                    'duration': break_duration,
                    'type': 'break',
                    'break_type': break_type,
                    'phase': 'break',
                    'icon': '☕'
                })
                task_id += 1
        
        total_time = sum(task['duration'] for task in tasks)
        work_tasks = [t for t in tasks if t['type'] == 'work']
        break_tasks = [t for t in tasks if t['type'] == 'break']
        
        return {
            'success': True,
            'plan': tasks,
            'analysis': analysis,
            'category': category,
            'total_time': total_time,
            'task_count': len(work_tasks),
            'break_count': len(break_tasks),
            'ai_enhanced': False  # Will be set to True if AI enhances it
        }

    def _adjust_timings(self, config, focus_history):
        """Adjust session timings based on user's focus history"""
        adjusted = config.copy()
        
        if not focus_history or len(focus_history) < 3:
            return adjusted
        
        # Calculate average focus from recent sessions
        recent_focus = focus_history[-5:] if len(focus_history) >= 5 else focus_history
        avg_focus = sum(recent_focus) / len(recent_focus)
        
        # Adjust timings based on focus patterns
        if avg_focus < 3.0:
            # Lower focus - shorter sessions, longer breaks
            adjusted['focus_time'] = max(20, config['focus_time'] - 15)
            adjusted['break_time'] = min(20, config['break_time'] + 5)
        elif avg_focus > 4.0:
            # High focus - can handle longer sessions
            adjusted['focus_time'] = min(60, config['focus_time'] + 15)
            adjusted['break_time'] = max(5, config['break_time'])
        
        return adjusted

    def _get_phase_duration(self, phase, base_duration, difficulty):
        """Get duration for each phase, adjusted for difficulty"""
        duration_map = {
            'warmup': 15,
            'main': base_duration,
            'deep': base_duration + 15
        }
        
        base = duration_map.get(phase, base_duration)
        
        # Adjust for difficulty
        if difficulty == 'challenging':
            return min(60, base + 10)
        elif difficulty == 'manageable':
            return max(15, base - 5)
        
        return base

    def _get_phase_task_name(self, phase, analysis):
        """Generate appropriate task names for each phase"""
        category = analysis['category']
        subject = analysis['subject']
        
        templates = {
            'study': {
                'warmup': f'Preview and organize {subject} materials',
                'main': f'Read and study {subject} content actively',
                'deep': f'Analyze and master {subject} concepts'
            },
            'revision': {
                'warmup': f'Quick {subject} review and setup',
                'main': f'Practice and test {subject} recall',
                'deep': f'Deep {subject} understanding check'
            },
            'assignment': {
                'warmup': f'Plan and organize {subject} assignment',
                'main': f'Work on {subject} assignment content',
                'deep': f'Refine and finalize {subject} work'
            }
        }
        
        if subject == 'general':
            # Simplified names when no specific subject
            simple_templates = {
                'study': {
                    'warmup': 'Preview and organize materials',
                    'main': 'Read and take detailed notes', 
                    'deep': 'Analyze and summarize concepts'
                },
                'revision': {
                    'warmup': 'Quick review of previous work',
                    'main': 'Active recall and practice',
                    'deep': 'Test understanding thoroughly'
                },
                'assignment': {
                    'warmup': 'Plan structure and gather resources',
                    'main': 'Work on main content',
                    'deep': 'Review and polish work'
                }
            }
            return simple_templates.get(category, {}).get(phase, 'Focus work session')
        
        return templates.get(category, {}).get(phase, f'Work on {subject} {phase} task')

    def _get_smart_break_activity(self, break_type, break_index, category):
        """Generate contextual break activities"""
        activities = {
            'short': [
                'Stretch and hydrate briefly',
                'Walk around and rest eyes', 
                'Light breathing exercise'
            ],
            'long': [
                'Take a refreshing walk outside',
                'Healthy snack and hydration',
                'Gentle stretching routine',
                'Brief mindfulness moment'
            ]
        }
        
        # Add category-specific break suggestions
        category_breaks = {
            'study': {
                'short': ['Review notes quickly', 'Organize study materials'],
                'long': ['Discuss concepts with someone', 'Write quick summary']
            },
            'revision': {
                'short': ['Quick concept recall test', 'Review flashcards'],
                'long': ['Explain concept out loud', 'Create memory aids']
            }
        }
        
        # Mix general and category-specific activities
        general_activities = activities[break_type]
        specific_activities = category_breaks.get(category, {}).get(break_type, [])
        
        all_activities = general_activities + specific_activities
        return all_activities[break_index % len(all_activities)]

    @lru_cache(maxsize=100)
    def get_cached_motivation(self, category, goal_hash, focus_level):
        """Cached motivation generation to reduce API calls"""
        cache_key = f"{category}_{goal_hash}_{focus_level}"
        
        # Check if cached and not expired
        if cache_key in self.motivation_cache:
            cached_item = self.motivation_cache[cache_key]
            if time.time() - cached_item['timestamp'] < self.cache_expiry:
                return cached_item['motivation']
        
        # Generate new motivation
        motivation = self._generate_ai_motivation(category, focus_level)
        
        # Cache it
        self.motivation_cache[cache_key] = {
            'motivation': motivation,
            'timestamp': time.time()
        }
        
        return motivation

    def _generate_ai_motivation(self, category, focus_level='medium'):
        """Single AI call for motivation only"""
        if not model:
            return self._get_fallback_motivation(category, focus_level)
        
        try:
            # Simplified prompt for better performance
            prompts = {
                'study': f"Generate a 4-word motivational phrase for studying (focus level: {focus_level}). Examples: 'Deep learning time! 📚', 'Knowledge awaits you! 🎯'",
                'revision': f"Generate a 4-word motivational phrase for review/practice (focus level: {focus_level}). Examples: 'Master those concepts! 🧠', 'Recall power activated! ⚡'", 
                'assignment': f"Generate a 4-word motivational phrase for assignment work (focus level: {focus_level}). Examples: 'Create something amazing! ✨', 'Progress time begins! 🚀'"
            }
            
            prompt = prompts.get(category, prompts['study'])
            
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=20,
                    temperature=0.8
                )
            )
            
            motivation = response.text.strip()
            
            # Validate response length
            if len(motivation.split()) <= 6 and len(motivation) <= 30:
                return motivation
            else:
                return self._get_fallback_motivation(category, focus_level)
                
        except Exception as e:
            logger.warning(f"AI motivation failed: {e}")
            return self._get_fallback_motivation(category, focus_level)

    def _get_fallback_motivation(self, category, focus_level='medium'):
        """Smart local motivation based on focus level"""
        motivations = {
            'study': {
                'low': ['Start small! 🌱', 'One step forward! 👣', 'You can do this! 💪'],
                'medium': ['Focus time! 🎯', 'Learning mode on! 📚', 'Dive deep today! 🌊'],
                'high': ['Unleash your potential! 🚀', 'Master mode activated! 🔥', 'Excellence awaits! ⭐']
            },
            'revision': {
                'low': ['Review and grow! 🌱', 'Memory building time! 🧠', 'Progress through practice! 📈'],
                'medium': ['Recall power up! ⚡', 'Testing knowledge! 🎯', 'Practice makes perfect! 💫'],
                'high': ['Memory mastery mode! 🧠', 'Recall excellence! ⚡', 'Knowledge champion! 🏆']
            },
            'assignment': {
                'low': ['Start creating! ✏️', 'Build something great! 🏗️', 'Progress beats perfection! 📈'],
                'medium': ['Creation mode on! ✨', 'Making it happen! 🚀', 'Productive flow time! 💫'],
                'high': ['Excellence in making! 🏆', 'Create masterpiece! 🎨', 'Peak productivity! ⚡']
            }
        }
        
        category_motivations = motivations.get(category, motivations['study'])
        level_motivations = category_motivations.get(focus_level, category_motivations['medium'])
        
        import random
        return random.choice(level_motivations)

    def enhance_plan_with_ai(self, base_plan, goal, focus_history=None):
        """Enhance base plan with AI motivation (single API call)"""
        category = base_plan['category']
        
        # Determine focus level from history
        focus_level = 'medium'
        if focus_history and len(focus_history) >= 3:
            avg_focus = sum(focus_history[-5:]) / min(5, len(focus_history))
            if avg_focus < 3.0:
                focus_level = 'low'
            elif avg_focus > 4.0:
                focus_level = 'high'
        
        # Generate motivation (cached)
        goal_hash = str(hash(goal)) # Simple hash for caching
        motivation = self.get_cached_motivation(category, goal_hash, focus_level)
        
        # Enhance the plan
        base_plan['motivation'] = motivation
        base_plan['ai_enhanced'] = True if model else False
        base_plan['focus_adjustments'] = self._get_focus_insights(focus_history)
        
        return base_plan

    def _get_focus_insights(self, focus_history):
        """Provide insights based on focus history"""
        if not focus_history or len(focus_history) < 3:
            return "Building your focus profile..."
            
        recent = focus_history[-5:]
        avg_focus = sum(recent) / len(recent)
        
        if avg_focus < 3.0:
            return "Optimized for focus building - shorter, manageable sessions"
        elif avg_focus > 4.0:
            return "Extended sessions - you're in great focus form!"
        elif len([f for f in recent if f >= 4]) >= 3:
            return "Consistent high focus - pushing your boundaries!"
        else:
            return f"Balanced approach for your {avg_focus:.1f}/5 focus level"

# Initialize planner
study_planner = SimplifiedStudyPlanner()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/generate_plan", methods=["POST"])
def generate_plan():
    """Streamlined plan generation endpoint"""
    try:
        data = request.json
        goal = data.get("prompt", "").strip()
        session_length = data.get("sessionLength", "medium")
        focus_history = data.get("focusHistory", [])
        
        # Input validation
        if not goal or len(goal) < 2:
            return jsonify({"error": "Please enter your study goal"}), 400

        logger.info(f"Generating plan: '{goal}' ({session_length})")
        
        # Step 1: Fast local analysis
        analysis = study_planner.analyze_goal_smart(goal)
        
        # Step 2: Generate base plan structure (local, fast)
        base_plan = study_planner.generate_base_plan(analysis, session_length, focus_history)
        
        # Step 3: Enhance with AI motivation (single API call, cached)
        enhanced_plan = study_planner.enhance_plan_with_ai(base_plan, goal, focus_history)
        
        logger.info(f"Plan generated successfully: {enhanced_plan['category']} category, {enhanced_plan['total_time']}min")
        
        return jsonify(enhanced_plan)

    except Exception as e:
        logger.error(f"Plan generation error: {e}")
        
        # Robust fallback
        try:
            analysis = study_planner.analyze_goal_smart(goal)
            fallback_plan = study_planner.generate_base_plan(analysis, session_length, focus_history)
            fallback_plan['motivation'] = study_planner._get_fallback_motivation(analysis['category'])
            fallback_plan['fallback_used'] = True
            
            return jsonify(fallback_plan)
        except:
            return jsonify({"error": "Unable to generate plan. Please try again."}), 500

@app.route("/generate_motivation", methods=["POST"])
def generate_motivation_only():
    """Separate endpoint for AI motivation (used by frontend)"""
    try:
        data = request.json
        category = data.get("category", "study")
        goal = data.get("goal", "")
        focus_history = data.get("focusHistory", [])
        
        # Determine focus level
        focus_level = 'medium'
        if focus_history and len(focus_history) >= 3:
            avg_focus = sum(focus_history) / len(focus_history)
            if avg_focus < 3.0:
                focus_level = 'low'
            elif avg_focus > 4.0:
                focus_level = 'high'
        
        # Generate cached motivation
        goal_hash = str(hash(goal))
        motivation = study_planner.get_cached_motivation(category, goal_hash, focus_level)
        
        return jsonify({
            'success': True,
            'motivation': motivation,
            'ai_used': model is not None
        })
        
    except Exception as e:
        logger.error(f"Motivation generation error: {e}")
        return jsonify({
            'success': True,
            'motivation': study_planner._get_fallback_motivation(
                data.get("category", "study"), 
                "medium"
            ),
            'ai_used': False
        })

@app.route("/session_complete", methods=["POST"])
def complete_session():
    """Enhanced session completion tracking"""
    try:
        data = request.json
        
        session_data = {
            'completion_rate': data.get('completion_rate', 0.8),
            'focus_score': data.get('focus_score', 3),
            'session_length': data.get('session_length', 'medium'),
            'task_type': data.get('task_type', 'study'),
            'duration': data.get('duration', 25),
            'timestamp': datetime.now().isoformat()
        }
        
        study_planner.record_session(session_data)
        
        # Generate completion message based on performance
        focus_score = session_data['focus_score']
        completion_rate = session_data['completion_rate']
        
        if focus_score >= 4 and completion_rate >= 0.9:
            message = "Outstanding session! 🌟 Keep this momentum!"
        elif focus_score >= 3 and completion_rate >= 0.7:
            message = "Solid progress! 💪 Building great habits!"
        elif completion_rate >= 0.5:
            message = "Good effort! 🌱 Every session counts!"
        else:
            message = "Thanks for trying! 💙 Tomorrow is a fresh start!"
        
        return jsonify({
            'success': True,
            'message': message,
            'streak_bonus': session_data.get('streak_bonus', False)
        })
        
    except Exception as e:
        logger.error(f"Session completion error: {e}")
        return jsonify({"error": "Failed to record session"}), 500

def record_session(self, session_data):
    """Record session with enhanced tracking"""
    self.session_history.append(session_data)
    
    # Keep last 50 sessions
    if len(self.session_history) > 50:
        self.session_history = self.session_history[-50:]

@app.route("/user_stats", methods=["GET"])
def get_user_stats():
    """Get user progress statistics"""
    try:
        if not study_planner.session_history:
            return jsonify({
                'success': True,
                'stats': {
                    'total_sessions': 0,
                    'avg_focus': 3.0,
                    'favorite_category': 'study',
                    'total_study_time': 0,
                    'streak': 0
                }
            })
        
        recent_sessions = study_planner.session_history[-20:]
        
        # Calculate statistics
        focus_scores = [s.get('focus_score', 3) for s in recent_sessions]
        avg_focus = round(sum(focus_scores) / len(focus_scores), 1)
        
        categories = [s.get('task_type', 'study') for s in recent_sessions]
        favorite_category = max(set(categories), key=categories.count) if categories else 'study'
        
        total_time = sum(s.get('duration', 25) for s in recent_sessions)
        
        return jsonify({
            'success': True,
            'stats': {
                'total_sessions': len(study_planner.session_history),
                'avg_focus': avg_focus,
                'favorite_category': favorite_category,
                'total_study_time': total_time,
                'recent_performance': focus_scores[-5:] if len(focus_scores) >= 5 else focus_scores
            }
        })
        
    except Exception as e:
        logger.error(f"Stats error: {e}")
        return jsonify({"error": "Failed to get statistics"}), 500

if __name__ == "__main__":
    # Add method to planner class
    SimplifiedStudyPlanner.record_session = record_session
    app.run(debug=True)