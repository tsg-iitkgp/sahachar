import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  BookOpen, CheckCircle, LogOut, ArrowLeft, 
  ChevronDown, ChevronRight, PlayCircle, FileText, Award, AlertCircle
} from 'lucide-react';
import CoursePlayer from './CoursePlayer';
import { resumeModule } from './services/courseNavigation';
import { 
  fetchCourseData, fetchUserProgress, updateUserProgressApi, 
  fetchCourseNote, saveCourseNote, submitQuery
} from './services/api';

export default function Dashboard({ user, onLogout, isPreviewMode = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = isPreviewMode ? '/admin' : '/dashboard';
  const restoreCourseRoute = useRef(location.pathname.includes('/course'));

  const currentView = location.pathname.includes('/course-completed') ? 'course-completed'
                    : location.pathname.includes('/course') ? 'course'
                    : location.pathname.includes('/completed') ? 'completed'
                    : 'browse';
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [activeModule, setActiveModule] = useState(null);
  const [expandedModules, setExpandedModules] = useState({ 1: true });
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isCourseNavigationOpen, setIsCourseNavigationOpen] = useState(false);
  
  const [courseData, setCourseData] = useState(null);
  const [progress, setProgress] = useState({});

  // Notes & Queries State
  const [notesText, setNotesText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteSaveStatus, setNoteSaveStatus] = useState('');
  const [queryText, setQueryText] = useState('');
  const [isSubmittingQuery, setIsSubmittingQuery] = useState(false);
  const [courseMainView, setCourseMainView] = useState('player'); // 'player', 'notes', 'queries'

  useEffect(() => {
    async function loadData() {
      const course = await fetchCourseData();
      setCourseData(course);
      
      let initialProgress = {};
      const totalMods = course.totalModules || Object.keys(course.modules || {}).length || 3;
      for (let i = 1; i <= totalMods; i++) {
        initialProgress[`${course.id || 'c1'}-m${i}`] = { 
          unlocked: i === 1, 
          passed: false, 
          videoWatched: false, 
          maxTimeWatched: 0 
        };
      }

      let loadedProgress = initialProgress;
      if (user?.id && !isPreviewMode) {
        const userProg = await fetchUserProgress(user.id, course.id || 'c1');
        loadedProgress = { ...initialProgress, ...userProg };
        
        const note = await fetchCourseNote(user.id, course.id || 'c1');
        setNotesText(note);
      }
      setProgress(loadedProgress);
      if (restoreCourseRoute.current) {
        const modNum = resumeModule(course, loadedProgress);
        setSelectedCourse(course);
        setActiveModule({ courseId: course.id, modNum, modKey: `${course.id}-m${modNum}` });
        setExpandedModules({ [modNum]: true });
        restoreCourseRoute.current = false;
      }
    }
    loadData();
  }, [user, isPreviewMode]);

  const handleSaveNote = async () => {
    if (isPreviewMode || !user?.id || !selectedCourse) return;
    setIsSavingNote(true);
    setNoteSaveStatus('');
    const saved = await saveCourseNote(user.id, selectedCourse.id, notesText);
    setNoteSaveStatus(saved ? 'Notes saved.' : 'Notes could not be saved. Please try again.');
    setIsSavingNote(false);
  };

  const handleSubmitQuery = async () => {
    if (isPreviewMode || !user?.id || !selectedCourse || !queryText.trim()) return;
    setIsSubmittingQuery(true);
    const success = await submitQuery(user.id, queryText, selectedCourse.id);
    setIsSubmittingQuery(false);
    if (success) {
      setQueryText('');
      alert('Your query has been submitted successfully.');
    } else {
      alert('Failed to submit query. Please try again later.');
    }
  };

  const coursesList = courseData ? [courseData] : [];

  const handleModuleClick = (courseId, modNum) => {
    const modKey = `${courseId}-m${modNum}`;
    const prevModKey = `${courseId}-m${modNum - 1}`;
    
    // A module is unlocked if explicitly marked unlocked, if it's the first module, 
    // or if the immediately preceding module has been passed.
    const isUnlocked = progress[modKey]?.unlocked || modNum === 1 || progress[prevModKey]?.passed;
    
    if (isUnlocked) {
      setActiveModule({ courseId, modNum, modKey });
      setExpandedModules(prev => ({ ...prev, [modNum]: true }));
      setCourseMainView('player');
      setIsCourseNavigationOpen(false);
    }
  };

  const toggleModuleExpansion = (modNum, e) => {
    e.stopPropagation();
    setExpandedModules(prev => ({ ...prev, [modNum]: !prev[modNum] }));
  };

  const updateModuleProgress = async (modKey, updates) => {
    setProgress(prev => {
      const updated = { ...prev };
      updated[modKey] = { ...updated[modKey], ...updates };
      
      if (updates.passed) {
        const parts = modKey.split('-m');
        const nextModNum = parseInt(parts[1]) + 1;
        const nextModKey = `${parts[0]}-m${nextModNum}`;
        if (updated[nextModKey]) {
          updated[nextModKey].unlocked = true;
        }
      }
      return updated;
    });

    if (user?.id && !isPreviewMode) {
      await updateUserProgressApi(user.id, modKey, updates);
    }
  };

  const isCourseCompleted = (courseId) => {
    const course = coursesList.find(c => c.id === courseId);
    if (!course) return false;
    for (let i = 1; i <= course.totalModules; i++) {
      if (!progress[`${courseId}-m${i}`]?.passed) return false;
    }
    return true;
  };

  const handleCourseStart = (course) => {
    setSelectedCourse(course);
    navigate(`${basePath}/course`);
    
    const modToOpen = resumeModule(course, progress);
    setExpandedModules({ [modToOpen]: true });
    handleModuleClick(course.id, modToOpen);
  };

  const handleGoBack = () => {
    navigate(`${basePath}/browse`);
    setSelectedCourse(null);
    setActiveModule(null);
    setCourseMainView('player');
    setIsCourseNavigationOpen(false);
    setIsNotesOpen(false);
  };

  // --- RENDER SIDEBAR ---
  const renderSidebar = () => {
    if (currentView === 'course' && selectedCourse) {
      return (
        <div className="sidebar course-sidebar">
          <div className="course-back">
            <button className="btn btn-outline" aria-label="Back to Dashboard" onClick={handleGoBack}>
              <ArrowLeft size={16} /><span className="course-back-label">Back to Dashboard</span><span className="course-back-short-label">Back</span>
            </button>
          </div>
          
          <div className="profile-section" style={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: 'none' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: 'var(--primary)' }}>{selectedCourse.title}</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>{selectedCourse.totalModules} Modules</p>
          </div>

          <button
            type="button"
            className="course-navigation-toggle btn btn-outline"
            aria-expanded={isCourseNavigationOpen}
            aria-label="Course modules"
            aria-controls="course-navigation"
            onClick={() => setIsCourseNavigationOpen(open => !open)}
          >
            <span>Modules <span className="course-module-count">({selectedCourse.totalModules})</span></span><ChevronDown size={18} />
          </button>
          <button className="course-notes-button btn btn-outline" aria-expanded={isNotesOpen} aria-controls="course-notes" onClick={() => setIsNotesOpen(open => !open)}>
            <FileText size={18} /> Notes
          </button>
          <div id="course-navigation" className={`nav-section course-navigation${isCourseNavigationOpen ? ' is-open' : ''}`}>
            {Object.keys(selectedCourse.modules || {}).map(Number).sort((a,b)=>a-b).map(modNum => {
              const modKey = `${selectedCourse.id}-m${modNum}`;
              const modData = progress[modKey] || { unlocked: modNum === 1, passed: false };
              const isExpanded = expandedModules[modNum];
              const isActiveMod = activeModule?.modKey === modKey && courseMainView === 'player';
              const prevModKey = `${selectedCourse.id}-m${modNum - 1}`;
              const prevPassed = progress[prevModKey]?.passed;
              const isLocked = !modData.unlocked && modNum !== 1 && !prevPassed;

              return (
                <div key={modKey} className="module-navigation-entry">
                  <div className={`module-navigation-row${isActiveMod ? ' is-active' : ''}`}>
                    <button className="module-navigation-link" disabled={isLocked} aria-current={isActiveMod ? 'step' : undefined} onClick={() => handleModuleClick(selectedCourse.id, modNum)}>
                      {modData.passed ? <CheckCircle size={18} /> : <PlayCircle size={18} />}
                      <span>Module {modNum}<small>{modData.passed ? 'Completed' : isLocked ? 'Complete the previous module first' : 'Lecture and assessment'}</small></span>
                    </button>
                    <button className="module-details-toggle" disabled={isLocked} aria-label={`Module ${modNum} details`} aria-expanded={Boolean(isExpanded)} aria-controls={`details-${modKey}`} onClick={(event) => toggleModuleExpansion(modNum, event)}>
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  </div>
                  {isExpanded && !isLocked && (
                    <div id={`details-${modKey}`} className="module-navigation-details">
                      <span><PlayCircle size={14} /> Video lecture {modData.videoWatched && <CheckCircle size={14} />}</span>
                      <span><FileText size={14} /> Assessment {modData.passed && <CheckCircle size={14} />}</span>
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ borderTop: '1px solid var(--border-color)', margin: '16px 0', paddingTop: '16px' }}>
              {/* Course Notes button removed from here */}
              <button
                type="button"
                className={`nav-item course-query-link ${courseMainView === 'queries' ? 'active' : ''}`}
                onClick={() => { setCourseMainView('queries'); setIsCourseNavigationOpen(false); }}
                style={{ padding: '12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', background: courseMainView === 'queries' ? '#f4f4f5' : 'transparent', color: courseMainView === 'queries' ? 'var(--primary)' : 'var(--text-main)', fontWeight: courseMainView === 'queries' ? '600' : '500' }}
              >
                <AlertCircle size={18} /> Queries & Complaints
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Default Dashboard Sidebar
    return (
      <div className="sidebar">
        <div className="profile-section">
          <div className="profile-avatar">{user.name?.charAt(0) || 'U'}</div>
          <div className="profile-info">
            <h3>{user.name}</h3>
            <p>{user.department}</p>
          </div>
        </div>

        <div className="nav-section">
          <div 
            className={`nav-item ${currentView === 'browse' ? 'active' : ''}`}
            onClick={() => navigate(`${basePath}/browse`)}
          >
            <BookOpen size={18} /> Browse Courses
          </div>
          
          <div 
            className={`nav-item ${currentView === 'completed' ? 'active' : ''}`}
            onClick={() => navigate(`${basePath}/completed`)}
          >
            <Award size={18} /> Courses Completed
          </div>
        </div>

        <div style={{ flex: 1 }}></div>
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
          <button className="btn btn-outline" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }} onClick={onLogout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>
    );
  };

  // --- RENDER MAIN AREA ---
  const renderMainArea = () => {
    if (currentView === 'course-completed' && selectedCourse) {
      return (
        <div className="course-completion">
          <div className="course-completion-card">
            <Award size={64} className="course-completion-icon" />
            <h1>Congratulations!</h1>
            <p className="course-completion-title">
              You have successfully completed {selectedCourse.title}.
            </p>
            <p className="course-completion-description">
              All modules and assessments are complete. You can review your lectures anytime from Courses Completed.
            </p>
            <button className="btn btn-primary" onClick={handleGoBack}>
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    if (currentView === 'course' && selectedCourse) {
      if (courseMainView === 'notes') {
        return (
          <div className="course-form">
            <h1 style={{ marginBottom: '8px' }}>Course Notes</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Write your personal notes for {selectedCourse.title}. They will be saved securely to your profile.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '60vh' }}>
              <textarea 
                value={notesText}
                onChange={(e) => { setNotesText(e.target.value); setNoteSaveStatus(''); }}
                style={{ flex: 1, padding: '24px', border: '1px solid var(--border-color)', borderRadius: '12px', resize: 'none', fontFamily: 'inherit', fontSize: '16px', lineHeight: '1.6' }}
                placeholder="Start typing your notes here..."
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={handleSaveNote} disabled={isSavingNote || isPreviewMode} style={{ padding: '12px 32px' }}>
                  {isSavingNote ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </div>
          </div>
        );
      }

      if (courseMainView === 'queries') {
        return (
          <div className="course-form">
            <h1 style={{ marginBottom: '8px' }}>Queries & Complaints</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Have a complaint or a question about {selectedCourse.title}? Submit a query below and the academic office will be notified.</p>
            {isPreviewMode && <p className="preview-notice">Queries cannot be sent from preview mode.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '50vh' }}>
              <textarea 
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                style={{ flex: 1, padding: '24px', border: '1px solid var(--border-color)', borderRadius: '12px', resize: 'none', fontFamily: 'inherit', fontSize: '16px', lineHeight: '1.6' }}
                placeholder="Describe your issue or query..."
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={handleSubmitQuery} disabled={isPreviewMode || isSubmittingQuery || !queryText.trim()} style={{ padding: '12px 32px' }}>
                  {isSubmittingQuery ? 'Submitting...' : 'Submit Query'}
                </button>
              </div>
            </div>
          </div>
        );
      }

      if (courseMainView === 'player' && activeModule) {
        const currentModuleInfo = courseData?.modules?.[activeModule.modNum];
        return (
          <CoursePlayer 
            key={activeModule.modKey}
            moduleKey={activeModule.modKey} 
            moduleNum={activeModule.modNum}
            totalModules={selectedCourse.totalModules}
            courseTitle={selectedCourse.title}
            moduleData={progress[activeModule.modKey]}
            moduleInfo={currentModuleInfo}
            userId={user.id}
            courseId={selectedCourse.id}
            isPreviewMode={isPreviewMode}
            updateProgress={updateModuleProgress}
            onNextModule={() => {
              const nextMod = activeModule.modNum + 1;
              if (nextMod <= selectedCourse.totalModules) {
                handleModuleClick(selectedCourse.id, nextMod);
              } else {
                navigate(`${basePath}/course-completed`);
              }
            }}
          />
        );
      }

      return (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <h2>Select a module from the sidebar to begin.</h2>
        </div>
      );
    }

    if (currentView === 'browse') {
      return (
        <div className="course-catalog">
          <h2>Browse Available Courses</h2>
          <div className="course-cards">
            {coursesList.map(course => (
              <div key={course.id} className="course-card big-card" onClick={() => handleCourseStart(course)}>
                <div className="card-image" style={{ backgroundImage: `url(${course.image})` }}></div>
                <div className="card-content">
                  <h3>{course.title}</h3>
                  <p className="card-desc">{course.description}</p>
                  <div className="card-meta">
                    <span>{course.totalModules} Modules</span>
                    <span className="badge">Mandatory Faculty Training</span>
                  </div>
                  <button className="btn btn-primary" style={{ width: '100%', marginTop: '16px', padding: '12px' }}>
                    Open Course
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (currentView === 'completed') {
      const completedCourses = coursesList.filter(c => isCourseCompleted(c.id));
      return (
        <div className="course-catalog">
          <h2>Courses Completed</h2>
          {completedCourses.length > 0 ? (
            <div className="course-cards">
              {completedCourses.map(course => (
                <div key={course.id} className="course-card big-card" style={{ borderLeft: '4px solid var(--success)' }}>
                  <div className="card-image" style={{ backgroundImage: `url(${course.image})`, filter: 'grayscale(100%)' }}></div>
                  <div className="card-content">
                    <h3>{course.title}</h3>
                    <p className="card-desc">You have successfully completed all modules and passed the mandatory assessments for this course.</p>
                    <p style={{ color: 'var(--success)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                      <CheckCircle size={16} /> Fully Completed & Certified
                    </p>
                    <button 
                      style={{ 
                        width: '100%', padding: '14px', marginTop: 'auto', 
                        background: 'var(--primary)', 
                        color: 'white', border: 'none', borderRadius: '4px', 
                        fontWeight: '600', fontSize: '15px', display: 'flex', 
                        justifyContent: 'center', alignItems: 'center', gap: '8px',
                        cursor: 'pointer', transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.background = 'var(--primary-hover)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = 'var(--primary)'; }}
                      onClick={() => alert(`Certificate of Completion issued to ${user.name} for Faculty Sensitization.`)}
                    >
                      <Award size={18} /> View Verified Certificate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="course-empty-state" style={{ marginTop: '60px' }}>
              <Award style={{ width: '64px', height: '64px', color: '#cbd5e1', marginBottom: '16px' }} />
              <h3>No courses completed yet</h3>
              <p>Finish all modules in a course to earn your official completion certificate.</p>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`app-layout${currentView === 'course' || currentView === 'course-completed' ? ' course-taking' : ''}${currentView === 'course-completed' ? ' is-course-complete' : ''}`}>
      {renderSidebar()}
      <div className="main-area">
        {renderMainArea()}
        {currentView === 'course' && (
          <button
            type="button"
            className={`notes-toggle${isNotesOpen ? ' is-open' : ''}`}
            aria-expanded={isNotesOpen}
            aria-controls="course-notes"
            onClick={() => setIsNotesOpen(open => !open)}
          >
            <FileText size={20} />
            <span>NOTES</span>
          </button>
        )}
      </div>

      {isNotesOpen && (
        <>
          <button className="notes-backdrop" aria-label="Close course notes" onClick={() => setIsNotesOpen(false)} />
          <aside id="course-notes" className="notes-panel" aria-label="Course notes">
            <div className="notes-panel-header">
              <h3><FileText size={18} /> My Notes</h3>
              <button className="notes-close" aria-label="Close notes" onClick={() => setIsNotesOpen(false)}>&times;</button>
            </div>
            <div className="notes-panel-body">
              {isPreviewMode && <p className="preview-notice">Notes are temporary in preview mode.</p>}
              <textarea
                value={notesText}
                onChange={(e) => { setNotesText(e.target.value); setNoteSaveStatus(''); }}
                placeholder="Write your notes here while watching the lecture..."
                aria-label="Lecture notes"
              />
            </div>
            <div className="notes-panel-footer">
              {noteSaveStatus && <p className="note-save-status" role="status">{noteSaveStatus}</p>}
              <button className="btn btn-primary" onClick={handleSaveNote} disabled={isSavingNote || isPreviewMode}>
                {isSavingNote ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
