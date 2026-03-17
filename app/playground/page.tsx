"use client";

import { useState, useEffect } from "react";
import { useInterview } from "@/hooks/useInterview";
import { QUESTIONS } from "@/lib/questions";
import TextEditor from "@/components/editor/TextEditor";
import ProfileCard from "@/components/interviewer/ProfileCard";
import ChatWindow from "@/components/chat/ChatWindow";
import RulesModal from "@/components/modals/RulesModal";
import EvaluationModal from "@/components/modals/EvaluationModal";

const PlaygroundPage = () => {
  const [showRules, setShowRules] = useState(true);
  const [showEval, setShowEval] = useState(false);
  const [timerLimit, setTimerLimit] = useState(10);

  const {
    messages,
    isRecording,
    isResponding,
    isEvaluating,
    evaluationResult,
    editorText,
    setEditorText,
    startInterview,
    endInterview,
  } = useInterview();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const difficulty = params.get("difficulty");
    if (difficulty && QUESTIONS[difficulty]) {
      setTimerLimit(QUESTIONS[difficulty].timer);
    }
  }, []);

  const handleRulesClose = () => {
    setShowRules(false);
    startInterview();
  };

  const handleTimeUp = async () => {
    setShowEval(true);
    await endInterview();
  };

  return (
    <>
      {showRules && <RulesModal onClose={handleRulesClose} />}
      {showEval && (
        <EvaluationModal isEvaluating={isEvaluating} result={evaluationResult} />
      )}

      <div className="flex h-screen w-full">
        <div className="w-2/3 border-r border-border">
          <TextEditor
            isRecording={isRecording}
            isResponding={isResponding}
            text={editorText}
            setText={setEditorText}
            timerLimit={timerLimit}
            onTimeUp={handleTimeUp}
          />
        </div>

        <div className="w-1/3 flex flex-col">
          <div className="h-1/3">
            <ProfileCard isResponding={isResponding} />
          </div>
          <div className="h-2/3">
            <ChatWindow messages={messages} />
          </div>
        </div>
      </div>
    </>
  );
};

export default PlaygroundPage;
