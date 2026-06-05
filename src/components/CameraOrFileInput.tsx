import { Camera, Upload } from "lucide-react";
import { useRef } from "react";

type Props = {
  accept?: string;
  onFile: (file: File) => void;
  disabled?: boolean;
};

/** Two-button mobile-friendly uploader: camera capture + file picker. */
export function CameraOrFileInput({ accept = "image/*,application/pdf", onFile, disabled }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
    e.target.value = "";
  };

  return (
    <div className="flex flex-wrap gap-2">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handle} className="hidden" />
      <input ref={fileRef} type="file" accept={accept} onChange={handle} className="hidden" />
      <button
        type="button"
        disabled={disabled}
        onClick={() => cameraRef.current?.click()}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
      >
        <Camera className="h-4 w-4" /> Tomar foto
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => fileRef.current?.click()}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
      >
        <Upload className="h-4 w-4" /> Subir archivo
      </button>
    </div>
  );
}
