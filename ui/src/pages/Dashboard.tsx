import { useState } from "react";
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

interface DashboardProps {
  onLogout: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

const Dashboard = ({ onLogout }: DashboardProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any | null>(null); // JSON de la API
  const [lastFilename, setLastFilename] = useState<string | null>(null); // nombre del archivo fuente

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

      setResult(data);
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

  // 👉 nuevo: descarga el JSON actual
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
              <div className="space-y-2">
                <Label htmlFor="file">Seleccionar archivo</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={handleFileChange}
                  accept=".xls,.xlsx,.csv"
                />
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

              {/* 👉 Botón para descargar JSON, solo si hay resultado */}
              {result && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadJson}
                >
                  Descargar JSON
                </Button>
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
