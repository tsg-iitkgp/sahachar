import React, { useState, useEffect, useRef } from 'react';

import YouTube from 'react-youtube';

import { AlertCircle, CheckCircle, Play, Pause, Volume2, VolumeX, ArrowRight, RotateCcw, Maximize, Minimize } from 'lucide-react';

import { recordQuizAttempt } from './services/api';



const DEFAULT_QUIZ_QUESTIONS = [

  {

    question: "What is the primary goal of this course module?",

    options: ["To skip videos", "To learn faculty sensitization", "To sleep", "Nothing"],

    correct: 1

  },

  {

    question: "How often should you review the material?",

    options: ["Never", "Weekly", "Yearly", "Daily"],

    correct: 1

  },

  {

    question: "What is the passing score?",

    options: ["50%", "60%", "80%", "100%"],

    correct: 2

  },

  {

    question: "Who is the target audience?",

    options: ["Students", "Faculty", "Staff", "Everyone"],

    correct: 1

  },

  {

    question: "What happens if you fail this quiz?",

    options: ["Nothing", "You must re-watch the video", "You get fired", "You get a warning"],

    correct: 1

  }

];



function formatTime(seconds) {

  if (!seconds || isNaN(seconds)) return "0:00";

  const m = Math.floor(seconds / 60);

  const s = Math.floor(seconds % 60);

  return `${m}:${s < 10 ? '0' : ''}${s}`;

}



export default function CoursePlayer({ 
  totalModules = 3,
  moduleKey, 
  moduleNum, 

  courseTitle, 

  moduleData, 

  moduleInfo,

  userId,

  courseId,

  updateProgress, 

  onNextModule,

  isPreviewMode

}) {

  const activeQuestions = (moduleInfo && moduleInfo.quiz && moduleInfo.quiz.length > 0) 

    ? moduleInfo.quiz 

    : DEFAULT_QUIZ_QUESTIONS;



  const passingThreshold = moduleInfo?.passingThreshold || 80;



  // Quiz State

  const [quizState, setQuizState] = useState(moduleData?.passed ? 'passed' : 'idle');

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);

  const [answers, setAnswers] = useState(Array(activeQuestions.length).fill(null));

  const [score, setScore] = useState(moduleData?.passed ? null : 0);



  // Custom Controls State

  const [isPlaying, setIsPlaying] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);

  const [duration, setDuration] = useState(0);

  const [volume, setVolume] = useState(100);

  const [isMuted, setIsMuted] = useState(false);

  const [playbackRate, setPlaybackRate] = useState(1);
  const [ccEnabled, setCcEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [playerRetry, setPlayerRetry] = useState(0);

  const intervalRef = useRef(null);
  const containerRef = useRef(null);
  const courseRef = useRef(null);
  const assessmentRef = useRef(null);

  const playerRef = useRef(null);

  const maxTimeRef = useRef(moduleData?.maxTimeWatched || 0);



  // Dashboard keys this component by module so each lecture starts with its own state.
  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    courseRef.current?.scrollIntoView({ block: 'start' });
  }, [moduleKey]);

  useEffect(() => {
    if (quizState !== 'idle') assessmentRef.current?.scrollIntoView({ block: 'start' });
  }, [quizState, currentQuestionIdx]);

  useEffect(() => {
    maxTimeRef.current = moduleData?.maxTimeWatched || 0;
  }, [moduleData?.maxTimeWatched]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(containerRef.current && document.fullscreenElement === containerRef.current));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(e => console.error(e));
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };



  const onPlayerReady = (event) => {

    playerRef.current = event.target;
    setIsPlayerReady(true);
    setPlayerError(false);

    try {

      const realDur = playerRef.current.getDuration();

      setDuration(realDur > 0 ? realDur : (moduleInfo?.durationSeconds || 600));

      setVolume(playerRef.current.getVolume());

      setIsMuted(playerRef.current.isMuted());

      setPlaybackRate(playerRef.current.getPlaybackRate());

    } catch (e) {

      console.error(e);

      setDuration(moduleInfo?.durationSeconds || 600);

    }

    

    if (moduleData?.maxTimeWatched > 0 && !moduleData?.passed) {

      playerRef.current.seekTo(moduleData.maxTimeWatched);

      setCurrentTime(moduleData.maxTimeWatched);

    }

  };



  const onStateChange = (event) => {

    const player = event.target;

    if (intervalRef.current) {

      clearInterval(intervalRef.current);

      intervalRef.current = null;

    }



    if (event.data === YouTube.PlayerState.PLAYING) {

      setIsPlaying(true);
      setDuration(player.getDuration() || moduleInfo?.durationSeconds || 0);

      intervalRef.current = setInterval(() => {

        const timeNow = player.getCurrentTime();

        setCurrentTime(timeNow);

        

        const currentSpeed = player.getPlaybackRate() || 1;

        const allowedBuffer = Math.max(4, currentSpeed * 2.5); 

        

        if (timeNow > maxTimeRef.current + allowedBuffer) {

          player.seekTo(maxTimeRef.current);

        } else {

          maxTimeRef.current = Math.max(maxTimeRef.current, timeNow);

          updateProgress(moduleKey, { maxTimeWatched: maxTimeRef.current });

        }

      }, 1000);

    } else {

      setIsPlaying(false);

      setCurrentTime(player.getCurrentTime());

    }

  };



  const onEnd = () => {

    if (intervalRef.current) clearInterval(intervalRef.current);

    setIsPlaying(false);

    updateProgress(moduleKey, { videoWatched: true });

  };



  // --- CONTROL ACTIONS ---

  const togglePlayPause = () => {

    if (playerRef.current) {

      if (isPlaying) playerRef.current.pauseVideo();

      else playerRef.current.playVideo();

    }

  };



  const toggleMute = () => {

    if (!playerRef.current) return;

    if (isMuted) {

      playerRef.current.unMute();

      setIsMuted(false);

      if (volume === 0) {

        setVolume(50);

        playerRef.current.setVolume(50);

      }

    } else {

      playerRef.current.mute();

      setIsMuted(true);

    }

  };



  const handleVolumeChange = (e) => {

    if (!playerRef.current) return;

    const val = Number(e.target.value);

    setVolume(val);

    playerRef.current.setVolume(val);

    

    if (val === 0 && !isMuted) {

      playerRef.current.mute();

      setIsMuted(true);

    } else if (val > 0 && isMuted) {

      playerRef.current.unMute();

      setIsMuted(false);

    }

  };



  const toggleCC = () => {
    if (!playerRef.current) return;
    try {
      if (ccEnabled) {
        playerRef.current.unloadModule('captions');
        setCcEnabled(false);
      } else {
        playerRef.current.loadModule('captions');
        playerRef.current.setOption('captions', 'track', {'languageCode': 'en'});
        setCcEnabled(true);
      }
    } catch(e) {
      console.error('CC error', e);
    }
  };

  const handleSpeedChange = (e) => {

    if (!playerRef.current) return;

    const rate = Number(e.target.value);

    setPlaybackRate(rate);

    playerRef.current.setPlaybackRate(rate);

  };



  // --- QUIZ LOGIC ---

  const handleAnswerSelect = (optIdx) => {

    setAnswers(prev => {

      const nextArr = [...prev];

      nextArr[currentQuestionIdx] = optIdx;

      return nextArr;

    });

  };



  const handleNextQuestion = () => {

    if (currentQuestionIdx < activeQuestions.length - 1) {

      setCurrentQuestionIdx(prev => prev + 1);

    } else {

      // Evaluate score

      let calculatedScore = 0;

      activeQuestions.forEach((q, idx) => {

        if (answers[idx] === q.correct) {

          calculatedScore++;

        }

      });

      

      setScore(calculatedScore);

      const percentage = (calculatedScore / activeQuestions.length) * 100;

      const passed = percentage >= passingThreshold;

      

      // Record attempt into database/attempts log

      if (!isPreviewMode) recordQuizAttempt({

        userId: userId || '123',

        courseId: courseId || 'c1',

        moduleNum,

        score: calculatedScore,

        totalQuestions: activeQuestions.length,

        passed

      });



      if (passed) {

        setQuizState('passed');

        updateProgress(moduleKey, { passed: true });

      } else {

        setQuizState('failed');

      }

    }

  };



  const handleReattempt = () => {

    setQuizState('idle');

    setCurrentQuestionIdx(0);

    setAnswers(Array(activeQuestions.length).fill(null));

    setScore(0);

    maxTimeRef.current = 0;

    updateProgress(moduleKey, { videoWatched: false, maxTimeWatched: 0, passed: false });

    playerRef.current = null;
    setCurrentTime(0);
    setIsPlayerReady(false);
    setPlayerError(false);
  };


  const startQuiz = () => {
    playerRef.current?.pauseVideo();
    if (intervalRef.current) clearInterval(intervalRef.current);
    setQuizState('taking');

  };



  const videoIds = {

    1: 'jNQXAC9IVRw', 

    2: 'M7lc1UVf-VE', 

    3: 'tPEE9ZwTmy0'

  };



  const currentVideoId = moduleInfo?.videoId || videoIds[moduleNum] || 'jNQXAC9IVRw';



  const youtubeOpts = React.useMemo(() => ({
    width: '100%',
    height: '100%',
    playerVars: { controls: 0, disablekb: 1, rel: 0, playsinline: 1, cc_load_policy: 1 }
  }), []);

  const retryPlayer = () => {
    playerRef.current = null;
    setIsPlayerReady(false);
    setPlayerError(false);
    setPlayerRetry(value => value + 1);
  };

  return (
    <section className="course-player" ref={courseRef}>
      <header className="content-header course-player-header">
        <div>
          <p className="course-module-label">Module {moduleNum} of {totalModules}</p>
          <h1>{moduleInfo?.title || `Module ${moduleNum}`}</h1>
          <p>{courseTitle}</p>
        </div>
      </header>

      {quizState === 'idle' && (
        <>
          {moduleData?.passed && <p className="module-completed-note"><CheckCircle size={20} /> Assessment complete. You can review this lecture.</p>}
          <div ref={containerRef} className="video-shell">
            <div className="video-stage">
              <YouTube
                key={`${moduleKey}-${playerRetry}`}
                videoId={currentVideoId}
                onReady={onPlayerReady}
                onStateChange={onStateChange}
                onEnd={onEnd}
                onError={() => { setPlayerError(true); setIsPlayerReady(false); }}
                className="youtube-container"
                iframeClassName="youtube-iframe"
                opts={youtubeOpts}
              />
              {!isPlayerReady && (
                <div className="video-status" role="status">
                  {playerError ? <><p>The lecture could not be loaded.</p><button className="btn btn-outline" onClick={retryPlayer}>Retry video</button></> : <p>Loading lecture…</p>}
                </div>
              )}
            </div>
            <div className="player-timeline">
              <span>{formatTime(currentTime)}</span>
              <div className="player-progress" role="progressbar" aria-label="Lecture progress" aria-valuemin={0} aria-valuemax={duration || 1} aria-valuenow={Math.min(currentTime, duration || 1)}>
                <div style={{ width: `${duration > 0 ? Math.min(currentTime / duration * 100, 100) : 0}%` }} />
              </div>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="player-controls">
              <button className="player-control" onClick={togglePlayPause} disabled={!isPlayerReady} aria-label={isPlaying ? 'Pause lecture' : 'Play lecture'} title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
              </button>
              <div className="player-volume">
                <button className="player-control" onClick={toggleMute} disabled={!isPlayerReady} aria-label={isMuted ? 'Unmute lecture' : 'Mute lecture'}>
                  {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input aria-label="Lecture volume" type="range" min="0" max="100" value={isMuted ? 0 : volume} onChange={handleVolumeChange} disabled={!isPlayerReady} />
              </div>
              <button className="player-control" onClick={toggleCC} disabled={!isPlayerReady} aria-label="Closed captions" aria-pressed={ccEnabled}>CC</button>
              <select className="player-speed" aria-label="Playback speed" value={playbackRate} onChange={handleSpeedChange} disabled={!isPlayerReady}>
                <option value={0.5}>0.5x</option><option value={1}>1.0x</option><option value={1.5}>1.5x</option><option value={2}>2.0x</option>
              </select>
              <button className="player-control" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
          {isPreviewMode && !moduleData?.passed && !moduleData?.videoWatched && (
            <div className="course-preview-actions"><button className="btn btn-outline" onClick={onEnd}><Play size={16} /> Skip Video (Admin Preview)</button></div>
          )}
          {moduleData?.videoWatched && !moduleData?.passed && (
            <div className="assessment-ready">
              <div><CheckCircle size={22} /><p><strong>Lecture complete</strong><span>Take the assessment to continue.</span></p></div>
              <button className="btn btn-primary" onClick={startQuiz}>Take Test <ArrowRight size={18} /></button>
            </div>
          )}
        </>
      )}

      {quizState === 'taking' && (
        <section ref={assessmentRef} className="assessment-card" aria-label="Module assessment">
          <p className="assessment-meta">Question {currentQuestionIdx + 1} of {activeQuestions.length}<span>Passing score: {passingThreshold}%</span></p>
          <h2 className="assessment-question" id="assessment-question">{activeQuestions[currentQuestionIdx].question}</h2>
          <div className="assessment-options" role="radiogroup" aria-labelledby="assessment-question">
            {activeQuestions[currentQuestionIdx].options.map((option, index) => (
              <label key={index} className={`quiz-option ${answers[currentQuestionIdx] === index ? 'selected' : ''}`}>
                <input type="radio" name={`q-${currentQuestionIdx}`} checked={answers[currentQuestionIdx] === index} onChange={() => handleAnswerSelect(index)} />
                <span>{option}</span>
              </label>
            ))}
          </div>
          <footer className="assessment-actions">
            <button className="btn btn-primary" disabled={answers[currentQuestionIdx] === null} onClick={handleNextQuestion}>
              {currentQuestionIdx === activeQuestions.length - 1 ? 'Submit Assessment' : 'Next Question'}
              {currentQuestionIdx !== activeQuestions.length - 1 && <ArrowRight size={18} />}
            </button>
          </footer>
        </section>
      )}

      {(quizState === 'passed' || quizState === 'failed') && (
        <section ref={assessmentRef} className={`assessment-result ${quizState === 'passed' ? 'is-passed' : 'is-failed'}`} aria-live="polite">
          {quizState === 'passed' ? <CheckCircle size={56} /> : <AlertCircle size={56} />}
          <h2>{quizState === 'passed' ? 'Assessment Passed!' : 'Assessment Failed'}</h2>
          <p className="assessment-score">{score === null ? 'You have already passed this assessment.' : `You scored ${Math.round(score / activeQuestions.length * 100)}% (${score}/${activeQuestions.length}).`}</p>
          <p>{quizState === 'passed' ? 'You can now continue to the next section.' : `A minimum score of ${passingThreshold}% is required. Review the full lecture before trying again.`}</p>
          <div className="assessment-result-actions">
            {quizState === 'passed' ? <>
              <button className="btn btn-primary" onClick={onNextModule}>{moduleNum < totalModules ? `Continue to Module ${moduleNum + 1}` : 'Finish course'} <ArrowRight size={18} /></button>
              <button className="btn btn-outline" onClick={() => { setIsPlayerReady(false); setQuizState('idle'); }}>Review lecture</button>
            </> : <button className="btn btn-danger" onClick={handleReattempt}><RotateCcw size={18} /> Reattempt Module</button>}
          </div>
        </section>
      )}
    </section>
  );
}
