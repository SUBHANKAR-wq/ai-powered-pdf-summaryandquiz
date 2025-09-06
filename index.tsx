import React, { useState, useCallback, DragEvent } from "react";
import ReactDOM from "react-dom/client";
import { GoogleGenAI, Type } from "@google/genai";

// Ensure pdfjs and marked are available in the global scope from the HTML script tags
declare const pdfjsLib: any;
declare const marked: any;

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js`;

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

type QuizQuestion = {
  question: string;
  type: "mcq" | "tf" | "short";
  options?: string[];
  answer: string;
};

type QuizData = {
  quiz: QuizQuestion[];
};

const QuizComponent = ({
  quizData,
  title,
}: {
  quizData: QuizData;
  title: string;
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>(
    Array(quizData.quiz.length).fill("")
  );
  const [isFinished, setIsFinished] = useState(false);

  const handleAnswerChange = (answer: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = answer;
    setUserAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestionIndex < quizData.quiz.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleFinish = () => {
    setIsFinished(true);
  };

  if (isFinished) {
    const score = quizData.quiz.reduce((acc, question, index) => {
      return (
        acc +
        (question.answer.toLowerCase() === userAnswers[index].toLowerCase()
          ? 1
          : 0)
      );
    }, 0);

    return (
      <div className="quiz-results">
        <h3>Quiz Results for "{title}"</h3>
        <p className="score">
          You scored {score} out of {quizData.quiz.length}
        </p>
        <ul className="results-list">
          {quizData.quiz.map((q, i) => (
            <li
              key={i}
              className={`result-item ${
                q.answer.toLowerCase() === userAnswers[i].toLowerCase()
                  ? "correct"
                  : "incorrect"
              }`}
            >
              <p>
                {i + 1}. {q.question}
              </p>
              <span>Your answer: {userAnswers[i] || "No answer"}</span>
              <br />
              <strong>Correct answer: {q.answer}</strong>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const currentQuestion = quizData.quiz[currentQuestionIndex];
  const progress =
    ((currentQuestionIndex + 1) / quizData.quiz.length) * 100;

  return (
    <div className="quiz-container">
      <h3>
        Question: {currentQuestionIndex + 1} / {quizData.quiz.length}
      </h3>
      <div className="quiz-progress">
        <div className="progress-bar" style={{ width: `${progress}%` }}></div>
      </div>
      <div className="quiz-question">
        <p>{currentQuestion.question}</p>
        {currentQuestion.type === "mcq" && (
          <ul className="quiz-options">
            {currentQuestion.options?.map((option, i) => (
              <li key={i}>
                <label>
                  <input
                    type="radio"
                    name="option"
                    value={option}
                    checked={userAnswers[currentQuestionIndex] === option}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                  />
                  <span>{option}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {currentQuestion.type === "tf" && (
          <ul className="quiz-options">
            <li>
              <label>
                <input
                  type="radio"
                  name="option"
                  value="True"
                  checked={userAnswers[currentQuestionIndex] === "True"}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                />
                <span>True</span>
              </label>
            </li>
            <li>
              <label>
                <input
                  type="radio"
                  name="option"
                  value="False"
                  checked={userAnswers[currentQuestionIndex] === "False"}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                />
                <span>False</span>
              </label>
            </li>
          </ul>
        )}
        {currentQuestion.type === "short" && (
          <input
            type="text"
            className="quiz-short-answer"
            value={userAnswers[currentQuestionIndex]}
            onChange={(e) => handleAnswerChange(e.target.value)}
            placeholder="Type your answer here..."
          />
        )}
      </div>
      <div className="quiz-navigation">
        {currentQuestionIndex < quizData.quiz.length - 1 ? (
          <button className="quiz-btn" onClick={handleNext}>
            Next Question
          </button>
        ) : (
          <button className="quiz-btn" onClick={handleFinish}>
            Finish Quiz
          </button>
        )}
      </div>
    </div>
  );
};

const App = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState<string | QuizData | null>(null);
  const [activeAction, setActiveAction] = useState<
    "summary" | "studyPlan" | "quiz" | null
  >(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copySuccess, setCopySuccess] = useState("");

  const processFile = useCallback(async (file: File) => {
    if (file && file.type === "application/pdf") {
      setOutput(null);
      setActiveAction(null);
      setSelectedFile(file);
      setIsLoading(true);
      setError("");
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let textContent = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const text = await page.getTextContent();
          textContent += text.items.map((s: any) => s.str).join(" ");
        }
        setPdfText(textContent);
      } catch (e) {
        setError("Failed to process PDF file. Please try another file.");
        console.error(e);
        setPdfText("");
        setSelectedFile(null);
      } finally {
        setIsLoading(false);
      }
    } else {
      setError("Please select a valid PDF file.");
      setSelectedFile(null);
      setPdfText("");
    }
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );
  
  const handleDragEvents = (e: DragEvent<HTMLElement>, drag: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(drag);
  }

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      handleDragEvents(e, false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleAction = useCallback(
    async (action: "summary" | "studyPlan" | "quiz") => {
      if (!pdfText) {
        setError("Please upload and process a PDF first.");
        return;
      }
      setIsLoading(true);
      setError("");
      setOutput(null);
      setCopySuccess("");
      setActiveAction(action);

      try {
        let prompt = "";
        let response;
        if (action === "summary") {
          prompt = `Provide a concise, well-structured summary of the following document. Use markdown for formatting:\n\n---\n${pdfText.substring(0, 100000)}\n---`;
          response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
          setOutput(response.text);
        } else if (action === "studyPlan") {
          prompt = `Based on the following document, create a detailed 4-week study plan. Break it down week by week with specific goals, topics to cover, and suggestions for revision. Use markdown for formatting:\n\n---\n${pdfText.substring(0, 100000)}\n---`;
          response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
          setOutput(response.text);
        } else if (action === "quiz") {
          const quizSchema = {
            type: Type.OBJECT,
            properties: {
              quiz: {
                type: Type.ARRAY, description: "An array of quiz questions.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ["mcq", "tf", "short"] },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    answer: { type: Type.STRING },
                  },
                  required: ["question", "type", "answer"],
                },
              },
            },
          };
          prompt = `Generate a 10-question quiz based on the following document. Include multiple-choice (mcq), true/false (tf), and short-answer (short) questions. For each question, provide the question, type, options (for mcq), and the correct answer. The answer for mcq must exactly match one of the options. Document content:\n\n---\n${pdfText.substring(0, 100000)}\n---`;
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash", contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: quizSchema },
          });
          const jsonText = response.text.trim();
          const quizData = JSON.parse(jsonText);
          setOutput(quizData as QuizData);
        }
      } catch (e) {
        console.error(e);
        setError("An error occurred while communicating with the AI. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [pdfText]
  );
  
  const handleCopy = () => {
    if (typeof output === 'string') {
        navigator.clipboard.writeText(output);
        setCopySuccess("Copied!");
        setTimeout(() => setCopySuccess(""), 2000);
    }
  }

  return (
    <div className="app-container">
      <header><h1>AI-Powered PDF Learning Assistant</h1></header>
      <main>
        <aside className="controls-panel">
          <h2>Controls</h2>
          <section
            className={`upload-section ${isDragging ? "drag-over" : ""}`}
            onDragEnter={(e) => handleDragEvents(e, true)}
            onDragLeave={(e) => handleDragEvents(e, false)}
            onDragOver={(e) => handleDragEvents(e, true)}
            onDrop={handleDrop}
          >
            <label htmlFor="pdf-upload" className="file-input-label">
              <i className="fa-solid fa-file-arrow-up"></i> Click to Upload
            </label>
            <p>or drag and drop PDF here</p>
            <input id="pdf-upload" type="file" accept="application/pdf" onChange={handleFileChange} />
            {selectedFile && <p className="file-info"><strong>File:</strong> {selectedFile.name}</p>}
          </section>
          {pdfText && (
            <section className="action-buttons">
              <button className={`action-btn ${activeAction === "summary" ? "active" : ""}`} onClick={() => handleAction("summary")} disabled={isLoading}>
                <i className="fa-solid fa-book-open"></i> Generate Summary
              </button>
              <button className={`action-btn ${activeAction === "studyPlan" ? "active" : ""}`} onClick={() => handleAction("studyPlan")} disabled={isLoading}>
                <i className="fa-solid fa-calendar-week"></i> Create Study Plan
              </button>
              <button className={`action-btn ${activeAction === "quiz" ? "active" : ""}`} onClick={() => handleAction("quiz")} disabled={isLoading}>
                <i className="fa-solid fa-circle-question"></i> Start Quiz
              </button>
            </section>
          )}
        </aside>
        <section className="output-panel">
          {isLoading ? (
            <div className="loading-indicator">
              <div className="loader"></div>
              <p>{pdfText ? "AI is working its magic..." : "Processing PDF..."}</p>
            </div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : !output ? (
            <div className="placeholder">
              <i className="fa-solid fa-robot"></i>
              <p>{selectedFile ? "Choose an action to begin." : "Upload a PDF to get started."}</p>
            </div>
          ) : activeAction === "quiz" && typeof output === "object" ? (
            <QuizComponent quizData={output as QuizData} title={selectedFile?.name || "Quiz"} />
          ) : (
            <>
              <button className="copy-btn" onClick={handleCopy}>
                {copySuccess || <><i className="fa-solid fa-copy"></i> Copy</>}
              </button>
              <div
                className="markdown-content"
                dangerouslySetInnerHTML={{ __html: marked.parse(output as string) }}
              ></div>
            </>
          )}
        </section>
      </main>
    </div>
  );
};

const container = document.getElementById("root");
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(<App />);
}
