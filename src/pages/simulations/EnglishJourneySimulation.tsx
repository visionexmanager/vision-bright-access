import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGameAudio } from "@/hooks/useGameAudio";
import { useSimulationProgress } from "@/hooks/useSimulationProgress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Plane, Hotel, UtensilsCrossed, ShoppingBag, RotateCcw, Star, ArrowRight, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { saveSimulationProgress } from "@/utils/saveSimulationProgress";
import { toast } from "sonner";

type Stage = "map" | "scenario" | "dialogue" | "results";

type DialogueLine = {
  speaker: "npc" | "player";
  text: string;
  choices?: { text: string; correct: boolean; feedback: string; points: number }[];
};

type Scenario = {
  id: string;
  location: string;
  emoji: string;
  icon: React.ReactNode;
  context: string;
  dialogues: DialogueLine[];
};

const SCENARIOS: Scenario[] = [
  {
    id: "airport",
    location: "Airport Check-in",
    emoji: "✈️",
    icon: <Plane className="h-8 w-8" />,
    context: "You just arrived at the airport and need to check in for your flight.",
    dialogues: [
      { speaker: "npc", text: "Good morning! May I see your passport and booking reference, please?" },
      {
        speaker: "player", text: "", choices: [
          { text: "Here you go. I have a booking under the name Smith.", correct: true, feedback: "Perfect response! Clear and polite.", points: 20 },
          { text: "What? I don't understand.", correct: false, feedback: "Try to respond with your documents ready.", points: 5 },
          { text: "I forgot my passport at home.", correct: false, feedback: "This would cause a real problem! Always bring your passport.", points: 0 },
        ]
      },
      { speaker: "npc", text: "Would you like a window seat or an aisle seat?" },
      {
        speaker: "player", text: "", choices: [
          { text: "A window seat, please. And could I get a seat near the emergency exit for more legroom?", correct: true, feedback: "Excellent! Specific and polite request.", points: 20 },
          { text: "I don't care.", correct: false, feedback: "Being specific helps get what you want.", points: 5 },
        ]
      },
      { speaker: "npc", text: "Do you have any checked baggage?" },
      {
        speaker: "player", text: "", choices: [
          { text: "Yes, one suitcase weighing about 20 kilos, and I have a carry-on as well.", correct: true, feedback: "Great! You provided all the details needed.", points: 20 },
          { text: "Just this bag.", correct: false, feedback: "More details help the agent process faster.", points: 10 },
        ]
      },
    ],
  },
  {
    id: "hotel",
    location: "Hotel Check-in",
    emoji: "🏨",
    icon: <Hotel className="h-8 w-8" />,
    context: "You arrive at the hotel reception to check in.",
    dialogues: [
      { speaker: "npc", text: "Welcome to the Grand Hotel! Do you have a reservation?" },
      {
        speaker: "player", text: "", choices: [
          { text: "Yes, I have a reservation under the name Johnson for three nights.", correct: true, feedback: "Clear and complete information!", points: 20 },
          { text: "Yeah, I booked something.", correct: false, feedback: "Provide your name and duration for faster service.", points: 5 },
        ]
      },
      { speaker: "npc", text: "Your room is on the 5th floor. Would you like help with your luggage?" },
      {
        speaker: "player", text: "", choices: [
          { text: "Yes, please. Also, could you tell me what time breakfast is served?", correct: true, feedback: "Smart to ask about breakfast now!", points: 20 },
          { text: "No thanks.", correct: false, feedback: "You missed an opportunity to learn about hotel services.", points: 10 },
        ]
      },
    ],
  },
  {
    id: "restaurant",
    location: "Restaurant Dining",
    emoji: "🍽️",
    icon: <UtensilsCrossed className="h-8 w-8" />,
    context: "You're at a restaurant and the waiter approaches your table.",
    dialogues: [
      { speaker: "npc", text: "Good evening! Would you like to hear our specials tonight?" },
      {
        speaker: "player", text: "", choices: [
          { text: "Yes, please! I'd also like to know if you have any vegetarian options.", correct: true, feedback: "Polite and proactive about dietary needs!", points: 20 },
          { text: "Just bring me food.", correct: false, feedback: "Restaurant etiquette requires more politeness.", points: 0 },
        ]
      },
      { speaker: "npc", text: "Would you like still or sparkling water? And would you like to see the wine list?" },
      {
        speaker: "player", text: "", choices: [
          { text: "Sparkling water, please. And I'd love to see the wine list. Could you recommend something to pair with fish?", correct: true, feedback: "Excellent! Asking for recommendations shows engagement.", points: 20 },
          { text: "Just tap water.", correct: false, feedback: "Correct but could engage more in the dining experience.", points: 10 },
        ]
      },
      { speaker: "npc", text: "How was everything? Would you like dessert or coffee?" },
      {
        speaker: "player", text: "", choices: [
          { text: "Everything was delicious, thank you! I'd love a cappuccino and the chocolate mousse, please. Could we also have the bill?", correct: true, feedback: "Perfect closing! Compliment, order, and bill request.", points: 20 },
          { text: "Bill please.", correct: false, feedback: "A bit abrupt. Try adding a compliment about the meal.", points: 5 },
        ]
      },
    ],
  },
  {
    id: "shopping",
    location: "Shopping Mall",
    emoji: "🛍️",
    icon: <ShoppingBag className="h-8 w-8" />,
    context: "You're looking for a specific item in a department store.",
    dialogues: [
      { speaker: "npc", text: "Hello! Can I help you find something today?" },
      {
        speaker: "player", text: "", choices: [
          { text: "Yes, I'm looking for a formal jacket for a business meeting. Do you have anything in navy blue, size medium?", correct: true, feedback: "Very specific request! This helps the salesperson assist you.", points: 20 },
          { text: "I'm just looking around.", correct: false, feedback: "If you need something specific, it's better to ask.", points: 5 },
        ]
      },
      { speaker: "npc", text: "This one is originally $200 but it's on sale for $150. Would you like to try it on?" },
      {
        speaker: "player", text: "", choices: [
          { text: "That's a great deal! Yes, I'd like to try it on. Do you also have a matching tie?", correct: true, feedback: "Great negotiation awareness and cross-selling!", points: 20 },
          { text: "Too expensive.", correct: false, feedback: "It's already on sale! Try negotiating or asking about alternatives.", points: 5 },
        ]
      },
    ],
  },
];

type Props = { simulationId?: string };

export function EnglishJourneySimulation({ simulationId }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { playSound } = useGameAudio();
  const { savedProgress } = useSimulationProgress(simulationId);

  const [stage, setStage] = useState<Stage>("map");
  const [score, setScore] = useState(0);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [completedScenarios, setCompletedScenarios] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{ text: string; correct: boolean } | null>(null);
  const [answered, setAnswered] = useState(false);
  const [conversationLog, setConversationLog] = useState<{ speaker: string; text: string }[]>([]);

  useEffect(() => {
    if (!savedProgress) return;
    const d = savedProgress.decisions as any;
    if (Array.isArray(d)) setCompletedScenarios(new Set(d));
    setScore(savedProgress.score ?? 0);
  }, [savedProgress]);

  const scenario = SCENARIOS.find(s => s.id === activeScenario);
  const currentLine = scenario?.dialogues[dialogueIndex];
  const allDone = completedScenarios.size === SCENARIOS.length;

  const startScenario = (id: string) => {
    if (completedScenarios.has(id)) {
      toast("Already completed! Try another scenario.");
      return;
    }
    playSound("select");
    setActiveScenario(id);
    setDialogueIndex(0);
    setFeedback(null);
    setAnswered(false);
    setConversationLog([]);
    setStage("dialogue");
  };

  const handleChoice = (choice: { text: string; correct: boolean; feedback: string; points: number }) => {
    if (answered) return;
    setAnswered(true);
    setFeedback({ text: choice.feedback, correct: choice.correct });
    setScore(prev => prev + choice.points);
    setConversationLog(prev => [...prev, { speaker: "You", text: choice.text }]);
    playSound(choice.correct ? "correct" : "wrong");
  };

  const nextDialogue = () => {
    if (!scenario) return;
    setFeedback(null);
    setAnswered(false);

    // If current line is NPC, we showed choices from next line, so advance by 2
    const step = currentLine?.speaker === "npc" ? 2 : 1;
    const next = dialogueIndex + step;

    if (next >= scenario.dialogues.length) {
      setCompletedScenarios(prev => new Set(prev).add(scenario.id));
      setStage("map");
      setActiveScenario(null);
      playSound("levelUp");
      toast.success(`${scenario.location} completed! Great communication!`);
      return;
    }

    // Add NPC line to conversation log if next is NPC
    const nextLine = scenario.dialogues[next];
    if (nextLine.speaker === "npc") {
      setConversationLog(prev => [...prev, { speaker: "NPC", text: nextLine.text }]);
    }
    setDialogueIndex(next);
  };

  const saveAndFinish = async () => {
    if (user && simulationId) {
      const { data: existing } = await supabase
        .from("simulation_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("simulation_id", simulationId)
        .maybeSingle();

      const payload = {
        current_step: completedScenarios.size,
        decisions: [...completedScenarios] as any,
        score,
        completed: true,
      };

      if (existing) {
        await supabase.from("simulation_progress").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("simulation_progress").insert([{ user_id: user.id, simulation_id: simulationId, ...payload }]);
      }
    }
    setStage("results");
    toast.success("Journey saved!");
  };

  const reset = () => {
    setStage("map");
    setScore(0);
    setActiveScenario(null);
    setDialogueIndex(0);
    setCompletedScenarios(new Set());
    setFeedback(null);
    setAnswered(false);
    setConversationLog([]);
  };

  if (stage === "results") {
    return (
      <div className="space-y-6">
        <Card className="border-green-500/40 bg-green-500/10">
          <CardContent className="pt-6 text-center space-y-4">
            <Star className="h-12 w-12 mx-auto text-amber-500" />
            <h2 className="text-2xl font-bold">English Journey Complete!</h2>
            <p className="text-4xl font-bold text-primary">{score} pts</p>
            <p className="text-muted-foreground">{completedScenarios.size}/{SCENARIOS.length} scenarios completed</p>
            <Button onClick={reset} variant="outline" className="gap-2"><RotateCcw className="h-4 w-4" /> Play Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine which choices to show: if current line is NPC, look at the next line for player choices
  const playerLine = currentLine?.speaker === "npc" && scenario
    ? scenario.dialogues[dialogueIndex + 1]
    : currentLine;
  const activeChoices = playerLine?.choices;

  if (stage === "dialogue" && scenario && currentLine) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            {scenario.emoji} {scenario.location}
          </h2>
          <Badge variant="secondary">{score} pts</Badge>
        </div>

        <p className="text-sm text-muted-foreground italic">{scenario.context}</p>

        {/* Conversation log */}
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {conversationLog.map((line, i) => (
            <div key={i} className={`flex ${line.speaker === "You" ? "justify-end" : "justify-start"}`}>
              <div className={`rounded-lg px-3 py-2 max-w-[80%] text-sm ${line.speaker === "You" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <p className="text-xs font-bold mb-1">{line.speaker}</p>
                <p>{line.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Current NPC message */}
        {currentLine.speaker === "npc" && (
          <Card className="border-primary/30">
            <CardContent className="pt-4">
              <p className="text-xs font-bold text-primary mb-1">🗣️ NPC</p>
              <p className="text-base">{currentLine.text}</p>
            </CardContent>
          </Card>
        )}

        {/* Player choices */}
        {activeChoices && !answered && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Your response:</p>
            {activeChoices.map((choice, i) => (
              <Button
                key={i}
                variant="outline"
                onClick={() => handleChoice(choice)}
                className="w-full h-auto py-3 text-left justify-start whitespace-normal"
              >
                <MessageCircle className="h-4 w-4 mr-2 shrink-0" />
                {choice.text}
              </Button>
            ))}
          </div>
        )}

        {feedback && (
          <Card className={feedback.correct ? "border-green-500/40 bg-green-500/10" : "border-destructive/40 bg-destructive/10"}>
            <CardContent className="pt-4 flex items-start gap-2">
              {feedback.correct ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" /> : <XCircle className="h-5 w-5 text-destructive shrink-0" />}
              <p className="text-sm">{feedback.text}</p>
            </CardContent>
          </Card>
        )}

        {answered && (
          <Button onClick={nextDialogue} className="w-full gap-2">
            <ArrowRight className="h-4 w-4" /> Continue
          </Button>
        )}
      </div>
    );
  }

  // Map view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">🌍 English Journey</h2>
        <Badge variant="secondary">{score} pts</Badge>
      </div>
      <p className="text-sm text-muted-foreground">Practice real-world English conversations in different scenarios. Choose a location and handle the dialogue!</p>

      <Progress value={(completedScenarios.size / SCENARIOS.length) * 100} className="h-2" />

      <div className="grid grid-cols-2 gap-4">
        {SCENARIOS.map(s => {
          const isDone = completedScenarios.has(s.id);
          return (
            <Card
              key={s.id}
              className={`cursor-pointer transition-all hover:shadow-md ${isDone ? "border-green-500/50 bg-green-500/5" : "hover:border-primary/50"}`}
              onClick={() => startScenario(s.id)}
            >
              <CardContent className="pt-6 text-center space-y-2 relative">
                {isDone && <CheckCircle2 className="h-4 w-4 absolute top-2 right-2 text-green-500" />}
                <div className="flex justify-center text-primary">{s.icon}</div>
                <p className="font-semibold text-sm">{s.location}</p>
                <p className="text-xs text-muted-foreground">{s.dialogues.filter(d => d.choices).length} dialogues</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {allDone && (
        <Card className="border-green-500/40 bg-green-500/10">
          <CardContent className="pt-4 text-center space-y-3">
            <CheckCircle2 className="h-8 w-8 mx-auto text-green-500" />
            <p className="font-semibold">All scenarios completed!</p>
            <p className="text-sm text-muted-foreground">Final Score: {score}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={saveAndFinish}>💾 Save & Finish</Button>
              <Button variant="outline" onClick={reset} className="gap-2"><RotateCcw className="h-4 w-4" /> Restart</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
