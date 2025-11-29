import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, FileText, LogOut } from "lucide-react";
import jsPDF from "jspdf";
import Loader from "@/components/Loader"; // 👈 importa tu loader

interface DashboardProps {
  onLogout: () => void;
}

// Puedes seguir usando la misma URL de API
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

/* ------------------------ Dashboard ------------------------ */

const Dashboard = ({ onLogout }: DashboardProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any | null>(null); // JSON de la API (informe 1)
  const [lastFilename, setLastFilename] = useState<string | null>(null); // nombre del archivo fuente

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

  const handleUpload = async () => {
    if (!file) {
      toast.error("Por favor selecciona un archivo");
      return;
    }

    setUploading(true);

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
        return;
      }

      setResult(data); // Informe 1
      setLastFilename(file.name); // guardamos el nombre original
      toast.success("Archivo procesado correctamente");
      setFile(null);
    } catch (err) {
      console.error(err);
      toast.error("Ocurrió un error al procesar el archivo");
    } finally {
      setUploading(false);
    }
  };

  // hay datos para el informe 1
  const hasResult =
    !!result && Array.isArray(result.students) && result.students.length > 0;

  // 👉 descarga el JSON actual (informe 1)
  const handleDownloadJson = () => {
    if (!hasResult) {
      toast.error("No hay resultados para descargar");
      return;
    }

    try {
      const jsonString = JSON.stringify(result, null, 2); // con indentación
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);

      const baseName =
        lastFilename?.replace(/\.[^/.]+$/, "") || "retroalimentacion";
      const filename = `${baseName}_informe1.json`;

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

  // 👉 descarga los resultados en PDF (informe 1)
  const handleDownloadPdf = () => {
    if (!hasResult) {
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

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = pageWidth - marginX * 2;

      const lineHeight = 14;
      let y = marginY;

      const baseName =
        lastFilename?.replace(/\.[^/.]+$/, "") || "retroalimentacion";
      const filename = `${baseName}_informe1.pdf`;

      const ensureSpace = (lines: number) => {
        const needed = lines * lineHeight;
        if (y + needed > pageHeight - marginY) {
          doc.addPage();
          y = marginY;
        }
      };

      result.students.forEach((student: any, index: number) => {
        if (index > 0) {
          y += lineHeight * 2;
        }

        doc.setFontSize(12);
        doc.setFont("Helvetica", "bold");

        const headerText = `${student.name} (${student.matricula})`;
        const headerLines = doc.splitTextToSize(headerText, maxWidth);

        ensureSpace(headerLines.length);
        doc.text(headerLines, marginX, y);
        y += headerLines.length * lineHeight + lineHeight * 0.3;

        doc.setFontSize(11);
        doc.setFont("Helvetica", "normal");

        const fdTitle = "Fuentes de Datos Segura:";
        const fdText = student.summary_fuentes_datos_segura || "";
        const fdLines = doc.splitTextToSize(`${fdTitle}\n${fdText}`, maxWidth);
        ensureSpace(fdLines.length + 1);
        doc.text(fdLines, marginX, y);
        y += fdLines.length * lineHeight + lineHeight * 0.5;

        const teTitle = "Trabajo en Equipo:";
        const teText = student.summary_trabajo_en_equipo || "";
        const teLines = doc.splitTextToSize(`${teTitle}\n${teText}`, maxWidth);
        ensureSpace(teLines.length + 1);
        doc.text(teLines, marginX, y);
        y += teLines.length * lineHeight;

        if (student.notes && student.notes.trim() !== "") {
          const notesTitle = "Nota:";
          const notesText = student.notes.trim();
          const notesLines = doc.splitTextToSize(
            `${notesTitle} ${notesText}`,
            maxWidth
          );
          ensureSpace(notesLines.length + 1);
          doc.setFontSize(10);
          doc.setTextColor(180, 120, 0);
          doc.text(notesLines, marginX, y);
          y += notesLines.length * lineHeight;
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(11);
        }
      });

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
            FeedbackAI
          </h1>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Salir
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Layout en dos columnas: izquierda subida, derecha informes */}
        <div className="grid gap-6 lg:grid-cols-2 items-start">
          {/* Columna izquierda: subida de archivos */}
          <div className="space-y-6">
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
                          isDragActive
                            ? "text-primary"
                            : "text-muted-foreground"
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

                {/* Loader infinito mientras se procesa */}
                {uploading && (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <span className="text-xs text-muted-foreground"></span>
                    <span className="text-xs text-muted-foreground"></span>
                    <span className="text-xs text-muted-foreground"></span>
                    <Loader />
                    <span className="text-xs text-muted-foreground"></span>
                    <span className="text-xs text-muted-foreground">
                      Procesando archivo, esto puede tomar un par de minutos...
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Columna derecha: resultados / informes */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informes generados</CardTitle>
                <CardDescription>
                  El archivo se procesará en 4 informes distintos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Informe 1 */}
                  <Card className="border-primary/40">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">
                            Informe 1: Retroalimentación por estudiante
                          </CardTitle>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-1 rounded-full ${
                            uploading
                              ? "bg-yellow-100 text-yellow-800"
                              : hasResult
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {uploading
                            ? "Generando..."
                            : hasResult
                            ? "Listo"
                            : "Pendiente"}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <p className="text-xs text-muted-foreground">
                        {hasResult
                          ? `Estudiantes procesados: ${result.students.length}`
                          : null}
                      </p>

                      {hasResult && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadPdf}
                          >
                            Descargar PDF
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadJson}
                          >
                            Descargar JSON
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Informe 2 */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">
                            Informe 2: (Próximamente)
                          </CardTitle>
                        </div>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                          En desarrollo
                        </span>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Informe 3 */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">
                            Informe 3: (Próximamente)
                          </CardTitle>
                        </div>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                          En desarrollo
                        </span>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Informe 4 */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">
                            Informe 4: (Próximamente)
                          </CardTitle>
                        </div>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                          En desarrollo
                        </span>
                      </div>
                    </CardHeader>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
