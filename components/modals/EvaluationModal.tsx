import { EvaluationResult } from "@/lib/types";

interface EvaluationModalProps {
  isEvaluating: boolean;
  result: EvaluationResult | null;
}

const EvaluationModal = ({ isEvaluating, result }: EvaluationModalProps) => {
  const handleGoHome = () => {
    window.location.href = "https://localhost:3001";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-bold mb-4">Interview Complete</h3>

        {isEvaluating ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            <p className="text-muted-foreground">Generating your feedback...</p>
          </div>
        ) : result?.breakdown ? (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Performance Summary:</h4>
              <p className="text-sm text-muted-foreground">{result.summary}</p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Score Breakdown:</h4>
              <div className="space-y-2 text-sm">
                {Object.entries(result.breakdown).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{key}:</span>
                    <span className="font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Final Score:</span>
                <span className="text-3xl font-bold text-primary">
                  {result.finalScore}/100
                </span>
              </div>
            </div>

            <button
              onClick={handleGoHome}
              className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-semibold hover:brightness-110 mt-4"
            >
              Back to Home
            </button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-4">
              Evaluation failed to load.
            </p>
            <button
              onClick={handleGoHome}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-semibold hover:brightness-110"
            >
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EvaluationModal;
