import { StudioLayout } from "./StudioLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  HelpCircle,
  FolderOpen,
  Upload,
  LayoutTemplate,
  Mic,
  AudioWaveform,
  Video,
  Image,
  FileSearch,
  Wrench,
  Sparkles,
  ArrowRight,
  Lock,
} from "lucide-react";

const TOPICS = [
  {
    icon: FolderOpen,
    title: "Projects",
    desc: "Create and manage your AI media projects. Organize content by project, add tags, and collaborate.",
    comingSoon: false,
    to: "/services/ai-media-studio/projects",
  },
  {
    icon: Upload,
    title: "Asset Library",
    desc: "Upload audio, video, images, and documents. Drag & drop supported with chunked upload for large files.",
    comingSoon: false,
    to: "/services/ai-media-studio/assets",
  },
  {
    icon: LayoutTemplate,
    title: "Templates",
    desc: "Start from pre-built configurations for speech, voice, and video generation.",
    comingSoon: false,
    to: "/services/ai-media-studio/templates",
  },
  {
    icon: Mic,
    title: "Text to Speech",
    desc: "Convert written text into high-quality, natural-sounding audio using advanced AI voices.",
    comingSoon: false,
    to: "/services/ai-media-studio/speech",
  },
  {
    icon: AudioWaveform,
    title: "Voice Cloning",
    desc: "Clone any voice from a short audio sample and use it for narration or content.",
    comingSoon: false,
    to: "/services/ai-media-studio/voice",
  },
  {
    icon: Video,
    title: "Text to Video",
    desc: "Generate short video clips from a script with AI-rendered visuals and narration.",
    comingSoon: false,
    to: "/services/ai-media-studio/video",
  },
  {
    icon: Image,
    title: "Text to Image",
    desc: "Generate images from text prompts using AI, with adjustable size and style.",
    comingSoon: false,
    to: "/services/ai-media-studio/image",
  },
  {
    icon: FileSearch,
    title: "Document Studio",
    desc: "OCR text extraction from images, plus AI-powered document summarization and analysis.",
    comingSoon: false,
    to: "/services/ai-media-studio/document",
  },
  {
    icon: Wrench,
    title: "Text Tools",
    desc: "Code Generator, Writing Assistant, Resume Builder, Presentation Generator, Logo/Icon Generator, and QR Generator.",
    comingSoon: false,
    to: "/services/ai-media-studio/text-tools",
  },
];

const FAQ = [
  {
    q: "What file types can I upload?",
    a: "Audio (MP3, WAV, FLAC, AAC), Video (MP4, MOV, WebM), Images (JPEG, PNG, GIF, WebP), and Documents (PDF, DOCX, TXT).",
  },
  {
    q: "How much storage do I get?",
    a: "Each account starts with 5 GB of storage. This will be expandable in future plans.",
  },
  {
    q: "Can I share projects with others?",
    a: "Project sharing and collaboration features are on the roadmap for Phase 3.",
  },
  {
    q: "When will AI generation be available?",
    a: "Text to Speech is targeted for Phase 2. Voice Cloning and Text to Video will follow in subsequent phases.",
  },
  {
    q: "Are my files private?",
    a: "Yes. All your assets and projects are private by default and only accessible to your account.",
  },
];

export default function Help() {
  return (
    <StudioLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <HelpCircle className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Help & Documentation</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Learn how to use AI Media Studio
            </p>
          </div>
        </div>

        {/* Feature overview */}
        <section aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TOPICS.map((topic) => {
              const Icon = topic.icon;
              return (
                <Card key={topic.title} className="relative">
                  {topic.comingSoon && (
                    <Badge
                      variant="secondary"
                      className="absolute top-3 right-3 text-[10px] gap-0.5 px-1.5 py-0"
                    >
                      <Lock className="h-2.5 w-2.5" />
                      Soon
                    </Badge>
                  )}
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      {topic.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">{topic.desc}</p>
                    {topic.to && !topic.comingSoon && (
                      <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        <Link to={topic.to}>
                          Open <ArrowRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-lg font-semibold mb-4">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {FAQ.map(({ q, a }) => (
              <Card key={q}>
                <CardContent className="p-4">
                  <p className="font-medium text-sm">{q}</p>
                  <p className="text-sm text-muted-foreground mt-1.5">{a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <div className="rounded-xl border bg-muted/30 p-5 flex items-start gap-4">
          <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">AI Media Studio is in active development</p>
            <p className="text-sm text-muted-foreground mt-1">
              Phase 1 delivers the full project management and asset library infrastructure.
              AI generation engines (Text to Speech, Voice Cloning, Text to Video) will be
              released in Phase 2 and beyond. Stay tuned!
            </p>
          </div>
        </div>
      </div>
    </StudioLayout>
  );
}
