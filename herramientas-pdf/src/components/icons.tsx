import {
  ArrowDownUp, Camera, Combine, FileDiff, FileImage, FileLock2, FileMinus, FileText, Files, FileSignature,
  FileType, Hash, Image, ImageDown, Layers, LockOpen, Minimize2, PenLine, RotateCw, ScanText, Scissors,
  ShieldOff, Trash2, Workflow, EyeOff, type LucideIcon,
} from 'lucide-react';

export const TOOL_ICONS: Record<string, LucideIcon> = {
  merge: Combine,
  split: Scissors,
  compress: Minimize2,
  organize: ArrowDownUp,
  rotate: RotateCw,
  trash: Trash2,
  imageToPdf: FileImage,
  pdfToImage: ImageDown,
  ocr: ScanText,
  word: FileType,
  text: FileText,
  numbers: Hash,
  sign: FileSignature,
  form: PenLine,
  lock: FileLock2,
  unlock: LockOpen,
  redact: EyeOff,
  metadata: ShieldOff,
  image: Image,
  camera: Camera,
  compare: FileDiff,
  batch: Layers,
  flow: Workflow,
  file: Files,
  minus: FileMinus,
};

export function ToolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = TOOL_ICONS[name] ?? Files;
  return <Icon className={className} aria-hidden="true" />;
}
