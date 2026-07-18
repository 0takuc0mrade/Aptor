"use client";

type FileFieldProps = Readonly<{
  accept?: string;
  help: string;
  label: string;
  onText: (text: string, file: File) => void | Promise<void>;
}>;

export function FileField({
  accept = "application/json,.json",
  help,
  label,
  onText,
}: FileFieldProps) {
  return (
    <label className="file-field">
      <span>{label}</span>
      <input
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file === undefined) return;
          void file.text().then((text) => onText(text, file));
          event.target.value = "";
        }}
        type="file"
      />
      <small>{help}</small>
    </label>
  );
}
