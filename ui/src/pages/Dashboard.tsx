import { useState, useRef, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, FileText, LogOut } from "lucide-react";
import jsPDF from "jspdf";

interface DashboardProps {
  onLogout: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
const ESTIMATED_DURATION_MS = 120_000; // 2 minutos
const PROGRESS_TARGET = 90; // hasta dónde llega la barra "fake"
const PROGRESS_INTERVAL_MS = 1_000; // cada cuánto actualizamos (1s)

const Dashboard = ({ onLogout }: DashboardProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any | null>(null); // JSON de la API
  const [lastFilename, setLastFilename] = useState<string | null>(null); // nombre del archivo fuente

  // 👇 nuevo: estado y ref para la barra de progreso
  const [progress, setProgress] = useState<number>(0);
  const [showProgress, setShowProgress] = useState<boolean>(false);
  const progressIntervalRef = useRef<number | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
    multiple: false,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const startFakeProgress = () => {
    setShowProgress(true);
    setProgress(5); // arranque rápido para que se vea que empezó

    const steps = ESTIMATED_DURATION_MS / PROGRESS_INTERVAL_MS;
    const increment = PROGRESS_TARGET / steps; // cuánto sube por tick

    const id = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= PROGRESS_TARGET) return prev; // no pasar de 90%
        const next = prev + increment;
        return next > PROGRESS_TARGET ? PROGRESS_TARGET : next;
      });
    }, PROGRESS_INTERVAL_MS);

    progressIntervalRef.current = id;
  };

  const stopFakeProgress = () => {
    if (progressIntervalRef.current !== null) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setProgress(100);
    // Pequeña pausa para que el usuario vea el 100%
    setTimeout(() => {
      setShowProgress(false);
      setProgress(0);
    }, 600);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Por favor selecciona un archivo");
      return;
    }

    setUploading(true);
    startFakeProgress();

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/api/files/process`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error("Error backend:", text);
        throw new Error("Error al procesar el archivo");
      }

      const text = await response.text(); // leemos como texto crudo primero
      console.log("Texto bruto desde backend:", text);

      let data: any;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("No se pudo parsear JSON:", e);
        toast.error("La respuesta del servidor no es un JSON válido");
        setUploading(false);
        stopFakeProgress();
        return;
      }

      setResult(data);
      setLastFilename(file.name); // guardamos el nombre original
      toast.success("Archivo procesado correctamente");
      setFile(null);
    } catch (err) {
      console.error(err);
      toast.error("Ocurrió un error al procesar el archivo");
    } finally {
      setUploading(false);
      stopFakeProgress();
    }
  };

  // 👉 descarga el JSON actual
  const handleDownloadJson = () => {
    if (!result) {
      toast.error("No hay resultados para descargar");
      return;
    }

    try {
      const jsonString = JSON.stringify(result, null, 2); // con indentación
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);

      // nombre sugerido: nombreArchivoOriginal_salida.json
      const baseName =
        lastFilename?.replace(/\.[^/.]+$/, "") || "retroalimentacion";
      const filename = `${baseName}_resultado.json`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error al generar descarga JSON:", err);
      toast.error("No se pudo descargar el archivo JSON");
    }
  };

  // 👉 descarga los resultados en PDF
  // 👉 descarga los resultados en PDF
  const handleDownloadPdf = () => {
    if (!result || !result.students || result.students.length === 0) {
      toast.error("No hay resultados para descargar");
      return;
    }

    try {
      const doc = new jsPDF({
        unit: "pt",
        format: "a4",
      });

      const marginX = 40;
      const marginY = 40;

      // dimensiones reales de la página
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = pageWidth - marginX * 2;

      const lineHeight = 14;
      let y = marginY;

      const baseName =
        lastFilename?.replace(/\.[^/.]+$/, "") || "retroalimentacion";
      const filename = `${baseName}_resultado.pdf`;

      // helper para salto de página
      const ensureSpace = (lines: number) => {
        const needed = lines * lineHeight;
        if (y + needed > pageHeight - marginY) {
          doc.addPage();
          y = marginY;
        }
      };

      result.students.forEach((student: any, index: number) => {
        // separación entre estudiantes (menos para el primero)
        if (index > 0) {
          y += lineHeight * 2;
        }

        // === Nombre + matrícula EN VARIAS LÍNEAS ===
        doc.setFontSize(12);
        doc.setFont("Helvetica", "bold");

        const headerText = `${student.name} (${student.matricula})`;
        const headerLines = doc.splitTextToSize(headerText, maxWidth);

        ensureSpace(headerLines.length);
        doc.text(headerLines, marginX, y);
        y += headerLines.length * lineHeight + lineHeight * 0.3;

        // Resto del contenido
        doc.setFontSize(11);
        doc.setFont("Helvetica", "normal");

        // Fuentes de Datos Segura
        const fdTitle = "Fuentes de Datos Segura:";
        const fdText = student.summary_fuentes_datos_segura || "";
        const fdLines = doc.splitTextToSize(`${fdTitle}\n${fdText}`, maxWidth);
        ensureSpace(fdLines.length + 1);
        doc.text(fdLines, marginX, y);
        y += fdLines.length * lineHeight + lineHeight * 0.5;

        // Trabajo en Equipo
        const teTitle = "Trabajo en Equipo:";
        const teText = student.summary_trabajo_en_equipo || "";
        const teLines = doc.splitTextToSize(`${teTitle}\n${teText}`, maxWidth);
        ensureSpace(teLines.length + 1);
        doc.text(teLines, marginX, y);
        y += teLines.length * lineHeight;

        // Nota por estudiante (si existe)
        if (student.notes && student.notes.trim() !== "") {
          const notesTitle = "Nota:";
          const notesText = student.notes.trim();
          const notesLines = doc.splitTextToSize(
            `${notesTitle} ${notesText}`,
            maxWidth
          );
          ensureSpace(notesLines.length + 1);
          doc.setFontSize(10);
          doc.setTextColor(180, 120, 0); // tono ámbar suave
          doc.text(notesLines, marginX, y);
          y += notesLines.length * lineHeight;
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(11);
        }
      });

      // Nota general (a nivel raíz) si existe
      if (result.notes && result.notes.trim() !== "") {
        y += lineHeight * 2;
        const rootNotesTitle = "Notas generales:";
        const rootNotesText = result.notes.trim();
        const rootLines = doc.splitTextToSize(rootNotesText, maxWidth);
        ensureSpace(rootLines.length + 2);

        doc.setFontSize(11);
        doc.setFont("Helvetica", "bold");
        doc.text(rootNotesTitle, marginX, y);
        y += lineHeight;
        doc.setFont("Helvetica", "normal");
        doc.text(rootLines, marginX, y);
      }

      doc.save(filename);
    } catch (err) {
      console.error("Error al generar PDF:", err);
      toast.error("No se pudo descargar el PDF");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-accent/20">
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            proyecto FDE
          </h1>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Salir
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Card de subida */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Subir archivos
              </CardTitle>
              <CardDescription>
                Sube archivos con nombres de alumnos, rúbricas y evaluaciones
                para generar retroalimentación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${
                    isDragActive
                      ? "border-primary bg-primary/10"
                      : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                  }
                `}
              >
                <input {...getInputProps()} onChange={handleFileChange} />
                <div className="flex flex-col items-center gap-2">
                  <div className="p-4 rounded-full bg-background shadow-sm">
                    <Upload
                      className={`h-8 w-8 ${
                        isDragActive ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {isDragActive
                        ? "Suelta el archivo aquí"
                        : "Arrastra tu archivo aquí"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      o haz clic para seleccionar (.xls, .xlsx, .csv)
                    </p>
                  </div>
                </div>
              </div>

              {file && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{file.name}</span>
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="w-full"
              >
                {uploading ? "Procesando..." : "Procesar archivo"}
              </Button>

              {/* 👇 Barra de progreso mientras se está procesando */}
              {showProgress && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Procesando archivo...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-secondary/60 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card de resultados / archivos recientes */}
          <Card>
            <CardHeader className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Resultados recientes</CardTitle>
                <CardDescription>
                  Resúmenes generados por la API
                </CardDescription>
              </div>

              {/* Botón para descargar JSON, solo si hay resultado */}
              {result && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadJson}
                  >
                    Descargar JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadPdf}
                  >
                    Descargar PDF
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!result || !result.students || result.students.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay resultados aún
                </p>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {result.students.map((student: any, idx: number) => (
                    <div
                      key={idx}
                      className="border rounded-lg p-3 bg-background/60 space-y-1"
                    >
                      <div className="flex justify-between items-center">
                        <p className="font-medium">
                          {student.name}{" "}
                          <span className="text-xs text-muted-foreground">
                            ({student.matricula})
                          </span>
                        </p>
                      </div>
                      <div className="mt-2">
                        <p className="text-xs font-semibold mb-1">
                          Fuentes de Datos Segura:
                        </p>
                        <p className="text-xs text-muted-foreground whitespace-pre-line">
                          {student.summary_fuentes_datos_segura}
                        </p>
                      </div>
                      <div className="mt-2">
                        <p className="text-xs font-semibold mb-1">
                          Trabajo en Equipo:
                        </p>
                        <p className="text-xs text-muted-foreground whitespace-pre-line">
                          {student.summary_trabajo_en_equipo}
                        </p>
                      </div>
                      {student.notes && student.notes.trim() !== "" && (
                        <p className="text-[10px] text-amber-700 mt-2">
                          Nota: {student.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
