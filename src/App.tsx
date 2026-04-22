/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { Trash2, Cloud, CloudOff, RefreshCw, Camera, FileText, Loader2, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from './supabaseClient';

// Déclaration pour TypeScript
declare global {
  const __APP_GEMINI_KEY__: string;
}

// Détection de la clé API (Injection forcée via Vite)
const API_KEY = typeof __APP_GEMINI_KEY__ !== 'undefined' ? __APP_GEMINI_KEY__ : "";
let ai: any = null;

if (API_KEY) {
  try {
    // ai = new GoogleGenerativeAI(API_KEY); // Non utilisé en mode direct
    ai = true; // Juste pour passer le check plus bas
  } catch (e) {
    console.error("Erreur d'initialisation de GoogleGenAI:", e);
  }
}


// ... (remaining of the file)

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const getTodayFormatted = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDaysElapsed = (dateStr: string, endDateStr?: string) => {
  if (!dateStr) return 0;
  const date = new Date(dateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date();
  end.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const isDateOlderThan30Days = (dateStr: string, endDateStr?: string) => {
  return getDaysElapsed(dateStr, endDateStr) > 30;
};

export default function App() {
  const [view, setView] = useState<'menu' | 'saisie' | 'consultation' | 'recherche' | 'stats'>(() => {
    return (sessionStorage.getItem('app_view') as any) || 'menu';
  });
  const [consultationTab, setConsultationTab] = useState<'enCours' | 'archivees'>('enCours');
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStartDate, setSearchStartDate] = useState("");
  const [searchEndDate, setSearchEndDate] = useState(() => getTodayFormatted());
  const [interventions, setInterventions] = useState(() => {
    const saved = localStorage.getItem('interventions');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Erreur parsing localStorage:", e);
      return [];
    }
  });

  const [formData, setFormData] = useState(() => {
    const saved = sessionStorage.getItem('app_formData');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      dateSaisie: "",
      numeroBon: "",
      demandeur: "",
      refBatiment: "",
      dateDemande: "",
      dateDevis: "",
      lieu: "",
      etage: "",
      piece: "",
      demande: "",
      description: "",
      atelier: "",
      passages: [{
        id: Date.now().toString(),
        dateExecution: "",
        travauxRealises: "",
        tempsPasse: "",
        nomIntervenant: "Christophe Meyer",
        nouveauPassageRequis: false,
        raisonNouveauPassage: "Demande de devis",
        autreRaison: ""
      }]
    };
  });

  const [currentId, setCurrentId] = useState<string | null>(() => {
    return sessionStorage.getItem('app_currentId');
  });

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractStep, setExtractStep] = useState<string | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'offline'>('offline');
  const [diagResult, setDiagResult] = useState<string | null>(null);
  const [isUploadingDevis, setIsUploadingDevis] = useState(false);
  const [pendingDevisPhotos, setPendingDevisPhotos] = useState<string[]>([]);
  const [statsFilter, setStatsFilter] = useState<'year' | 'month' | 'range'>('year');
  const [statsYear, setStatsYear] = useState(() => new Date().getFullYear().toString());
  const [statsMonth, setStatsMonth] = useState(() => (new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [statsStart, setStatsStart] = useState("");
  const [statsEnd, setStatsEnd] = useState("");
  const sigCanvas = useRef<any>(null);
  const devisInputRef = useRef<HTMLInputElement>(null);

  const fetchInterventions = async () => {
    if (!import.meta.env.VITE_SUPABASE_URL) {
      setSyncStatus('offline');
      return;
    }

    setSyncStatus('syncing');
    try {
      const { data, error } = await supabase
        .from('interventions')
        .select('*')
        .order('dateSaisie', { ascending: false });

      if (error) throw error;
      
      if (data) {
        setInterventions(data);
      }
      setSyncStatus('synced');
    } catch (err) {
      console.error("Erreur de synchronisation:", err);
      setSyncStatus('error');
    }
  };

  // Chargement initial et Temps Réel
  useEffect(() => {
    fetchInterventions();

    if (import.meta.env.VITE_SUPABASE_URL) {
      // S'abonner aux changements en temps réel
      const channel = supabase
        .channel('db-changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'interventions' 
        }, () => {
          fetchInterventions();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('app_view', view);
  }, [view]);

  useEffect(() => {
    sessionStorage.setItem('app_formData', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    if (currentId) {
      sessionStorage.setItem('app_currentId', currentId);
    } else {
      sessionStorage.removeItem('app_currentId');
    }
  }, [currentId]);

  useEffect(() => {
    localStorage.setItem('interventions', JSON.stringify(interventions));
  }, [interventions]);

  // Fonction de synchronisation unitaire
  const syncIntervention = async (item: any) => {
    if (!import.meta.env.VITE_SUPABASE_URL) return;
    
    setSyncStatus('syncing');
    try {
      const { error } = await supabase
        .from('interventions')
        .upsert(item);
      
      if (error) throw error;
      setSyncStatus('synced');
    } catch (err) {
      console.error("Erreur de sauvegarde Supabase:", err);
      setSyncStatus('error');
    }
  };

  const runDiagnostic = async () => {
    if (!API_KEY) {
      setDiagResult("Erreur : Clé API manquante.");
      return;
    }
    setDiagResult("Interrogation de Google...");
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const models = data.models?.map((m: any) => m.name.replace('models/', '')).join(', ') || "Aucun modèle trouvé.";
      setDiagResult(`Modèles dispos : ${models}`);
    } catch (err: any) {
      setDiagResult(`Échec du diagnostic : ${err.message}`);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (formData.signature) return;
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePassageChange = (id: string, field: string, value: any) => {
    if (formData.signature) return;
    setFormData((prev: any) => ({
      ...prev,
      passages: prev.passages.map((p: any) => p.id === id ? { ...p, [field]: value } : p)
    }));
  };

  const addPassage = () => {
    if (formData.signature) return;
    setFormData((prev: any) => ({
      ...prev,
      passages: [...(prev.passages || []), {
        id: Date.now().toString(),
        dateExecution: prev.dateSaisie || "",
        travauxRealises: "",
        tempsPasse: "",
        nomIntervenant: "Christophe Meyer",
        nouveauPassageRequis: false,
        raisonNouveauPassage: "Demande de devis",
        autreRaison: ""
      }]
    }));
  };

  const removePassage = (id: string) => {
    if (formData.signature) return;
    if (!window.confirm("Voulez-vous vraiment supprimer ce passage ?")) return;
    setFormData((prev: any) => ({
      ...prev,
      passages: prev.passages.filter((p: any) => p.id !== id)
    }));
  };

  const handleSave = () => {
    if (formData.signature) return;
    let dataToSave = { ...formData };
    if (dataToSave.passages && dataToSave.passages.length > 0) {
      dataToSave.dateExecution = dataToSave.passages[0].dateExecution;
      dataToSave.nomIntervenant = dataToSave.passages[0].nomIntervenant;
      dataToSave.tempsPasse = dataToSave.passages[0].tempsPasse;
      dataToSave.travauxRealises = dataToSave.passages[0].travauxRealises;
    }

    const newId = currentId || Date.now().toString();
    const itemToSync = { ...dataToSave, id: newId };

    if (currentId) {
      setInterventions(interventions.map((i: any) => i.id === currentId ? itemToSync : i));
    } else {
      setInterventions([...interventions, itemToSync]);
    }
    
    syncIntervention(itemToSync);
    setView('menu');
  };

  const parseDuration = (d: string) => {
    if (!d) return 0;
    const match = d.match(/(\d+)h(\d+)/i);
    if (match) return parseInt(match[1]) * 60 + parseInt(match[2]);
    const hours = parseInt(d);
    return isNaN(hours) ? 0 : hours * 60;
  };

  const formatDuration = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
  };

  const processImage = async (file: File) => {
    setIsExtracting(true);
    setExtractionError(null);
    setExtractStep("Préparation...");
    try {
      if (file.size > 25 * 1024 * 1024) {
        throw new Error("L'image est vraiment trop lourde (plus de 25 Mo).");
      }

      setExtractStep("Compression...");
      // Wrap compression in a safe try/catch
      let processedFile = file;
      try {
        const options = {
          maxSizeMB: 1, // Compress to ~1MB (perfect for AI without losing readability)
          maxWidthOrHeight: 1800, // Keeps text readable 
          useWebWorker: true, // Prevents locking the UI thread
          fileType: "image/jpeg"
        };
        processedFile = await imageCompression(file, options);
      } catch (err) {
        console.warn("Échec de la compression, utilisation de l'image originale:", err);
      }

      setExtractStep("Lecture intelligente...");
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Impossible de lire l'image préparée."));
        reader.readAsDataURL(processedFile);
      });

      const base64 = base64Data.split(',')[1];
      const mimeType = processedFile.type || 'image/jpeg';
      
      console.log(`[Diagnostic] Taille finale avant envoi: ${processedFile.size} octets. Type: ${mimeType}`);

      setExtractStep("Envoi à l'IA...");
      
      if (!API_KEY) {
        throw new Error("La clé API Gemini n'est pas configurée.");
      }
      
      // Liste des modèles DÉTECTÉS via votre diagnostic (Vérifié !)
      const modelsToTry = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash-lite"
      ];

      let lastError: any = null;
      let result: any = null;

      for (let i = 0; i < modelsToTry.length; i++) {
        const modelName = modelsToTry[i];
        try {
          if (i > 0) {
            console.log("[IA] Pause de 2s avant nouvel essai...");
            setExtractStep("Surcharge... Nouvelle tentative...");
            await new Promise(r => setTimeout(r, 2000));
          }

          console.log(`[IA] Tentative ${i + 1} avec : ${modelName}...`);
          setExtractStep(`Analyse (${modelName})...`);

          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
          
          const payload = {
            contents: [{
              parts: [
                { inlineData: { mimeType: mimeType, data: base64 } },
                { text: "Extract the following fields from this intervention form. IMPORTANT: For dates (dateSaisie, dateExecution, dateDemande, dateDevis), extract the value and convert it strictly into YYYY-MM-DD format. Output the response strictly as a JSON object with these keys: dateSaisie, numeroBon, demandeur, refBatiment, dateDemande, dateDevis, lieu, etage, piece, demande, description, atelier, dateExecution, travauxRealises, tempsPasse, nomIntervenant." }
              ]
            }],
            generationConfig: { response_mime_type: "application/json" }
          };

          const fetchPromise = fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const timeoutPromise = new Promise<any>((_, reject) => 
            setTimeout(() => reject(new Error("Timeout")), 30000)
          );

          const responseRaw: any = await Promise.race([fetchPromise, timeoutPromise]);
          
          if (!responseRaw.ok) {
            const errorText = await responseRaw.text();
            throw new Error(errorText);
          }

          result = await responseRaw.json();
          console.log(`[IA] Succès avec ${modelName} !`);
          break; // Sortie de la boucle si succès
        } catch (err: any) {
          console.warn(`[IA] Échec avec ${modelName}:`, err.message);
          lastError = err;
          // Si c'est le dernier modèle, on laisse l'erreur remonter au bloc catch principal
        }
      }

      if (!result) throw lastError;
      console.log("[Diagnostic] Réponse finale reçue de l'IA !");

      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (responseText) {
        let text = responseText.trim();
        if (text.startsWith("```json")) text = text.replace(/^```json/, "");
        if (text.startsWith("```")) text = text.replace(/^```/, "");
        if (text.endsWith("```")) text = text.replace(/```$/, "");
        
        try {
          const extractedData = JSON.parse(text);
          
          // Vérifier si l'IA a vraiment trouvé quelque chose
          const hasData = Object.values(extractedData).some(val => val && String(val).trim() !== "");
          if (!hasData) {
            setExtractionError("L'IA a scanné l'image mais n'a pu lire aucune information valide. Assurez-vous que la photo soit bien nette.");
            return;
          }

          setFormData((prev: any) => {
            const newData = { ...prev };
            // On ne met à jour que les champs où l'IA a trouvé quelque chose de non-vide
            Object.keys(extractedData).forEach(key => {
              if (extractedData[key] && extractedData[key].trim() !== "") {
                newData[key] = extractedData[key];
              }
            });
            
            if (newData.passages && newData.passages.length > 0) {
              newData.passages = [...newData.passages];
              newData.passages[0] = {
                ...newData.passages[0],
                dateExecution: extractedData.dateExecution || newData.passages[0].dateExecution,
                travauxRealises: extractedData.travauxRealises || newData.passages[0].travauxRealises,
                tempsPasse: extractedData.tempsPasse || newData.passages[0].tempsPasse,
                nomIntervenant: extractedData.nomIntervenant || newData.passages[0].nomIntervenant,
              };
            }
            return newData;
          });
        } catch (parseError: any) {
          console.error("JSON Parse Error:", parseError, "Text:", text);
          setExtractionError("Erreur de lecture du format de données renvoyé par l'IA.");
        }
      } else {
        console.error("Empty response from AI", result);
        setExtractionError("Erreur technique : Le serveur IA n'a répondu aucun texte.");
      }
    } catch (error: any) {
      console.error("Extraction error:", error);
      let errorMessage = error?.message || "Erreur de connexion lors du traitement.";
      
      try {
        if (errorMessage.includes('{')) {
          const start = errorMessage.indexOf('{');
          const jsonStr = errorMessage.substring(start);
          const parsed = JSON.parse(jsonStr);
          if (parsed.error && parsed.error.message) {
            errorMessage = parsed.error.message;
          }
        }
      } catch (e) {}

      setExtractionError(errorMessage);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDevisPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsUploadingDevis(true);
    try {
      const files = Array.from(e.target.files);
      const newPhotos: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const options = {
          maxSizeMB: 0.7,
          maxWidthOrHeight: 1280,
          useWebWorker: true,
          fileType: "image/jpeg"
        };
        const compressedFile = await imageCompression(file, options);
        
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(compressedFile);
        });
        newPhotos.push(dataUrl);

      }
      
      setPendingDevisPhotos(prev => [...prev, ...newPhotos]);
    } catch (err: any) {
      console.error("Erreur capture photos:", err);
      alert("Erreur lors de la capture : " + (err.message || "Erreur inconnue"));
    } finally {
      setIsUploadingDevis(false);
    }
  };

  const generateFinalDevisPDF = async () => {
    if (pendingDevisPhotos.length === 0) return;
    
    setIsUploadingDevis(true);
    try {
      const pdf = new jsPDF();
      
      for (let i = 0; i < pendingDevisPhotos.length; i++) {
        if (i > 0) pdf.addPage();
        
        const dataUrl = pendingDevisPhotos[i];
        const imgProps = pdf.getImageProperties(dataUrl);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }
      
      const pdfBlob = pdf.output('blob');
      const fileName = `devis_${currentId || 'new'}_${Date.now()}.pdf`;
      const filePath = `${currentId || 'temp'}/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('devis')
        .upload(filePath, pdfBlob);
        
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('devis')
        .getPublicUrl(filePath);
        
      const updatedData = { ...formData, urlDevis: publicUrl };
      setFormData(updatedData);
      setPendingDevisPhotos([]); // Vider le buffer
      
      if (currentId) {
        syncIntervention({ ...updatedData, id: currentId });
      }
      
      alert("Devis PDF généré avec succès ! (" + pendingDevisPhotos.length + " pages)");
    } catch (err: any) {
      console.error("Erreur génération PDF:", err);
      alert("Erreur lors de la création du PDF : " + (err.message || "Erreur inconnue"));
    } finally {
      setIsUploadingDevis(false);
    }
  };

  const removeDevis = async () => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce devis ?")) return;
    
    const oldUrl = formData.urlDevis;
    const updatedData = { ...formData, urlDevis: null };
    setFormData(updatedData);
    
    if (currentId) {
      syncIntervention({ ...updatedData, id: currentId });
    }

    // Tentative de suppression du fichier physique dans Storage
    if (oldUrl) {
      try {
        const urlParts = oldUrl.split('/devis/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await supabase.storage.from('devis').remove([filePath]);
        }
      } catch (err) {
        console.error("Erreur lors de la suppression du fichier storage:", err);
      }
    }
  };

  const openForm = (intervention: any | null = null) => {
    if (intervention) {
      let data = { ...intervention };
      if (!data.passages || data.passages.length === 0) {
        data.passages = [{
          id: Date.now().toString(),
          dateExecution: data.dateExecution || "",
          travauxRealises: data.travauxRealises || "",
          tempsPasse: data.tempsPasse || "",
          nomIntervenant: data.nomIntervenant || "Christophe Meyer",
          nouveauPassageRequis: false,
          raisonNouveauPassage: "Demande de devis",
          autreRaison: ""
        }];
      }
      setFormData(data);
      setCurrentId(data.id);
    } else {
      setFormData({
        dateSaisie: "",
        numeroBon: "",
        demandeur: "",
        refBatiment: "",
        dateDemande: "",
        dateDevis: "",
        lieu: "",
        etage: "",
        piece: "",
        demande: "",
        description: "",
        atelier: "",
        passages: [{
          id: Date.now().toString(),
          dateExecution: "",
          travauxRealises: "",
          tempsPasse: "",
          nomIntervenant: "Christophe Meyer",
          nouveauPassageRequis: false,
          raisonNouveauPassage: "Demande de devis",
          autreRaison: ""
        }]
      });
      setCurrentId(null);
    }
    setView('saisie');
  };

  const renderMenu = () => (
    <div className="w-full max-w-lg bg-[#415A77] shadow-2xl border border-slate-500 rounded-lg overflow-hidden">
      <div className="bg-[#1B263B] p-6 border-b-4 border-amber-500">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Maintenance <span className="text-amber-500">Colmar</span></h1>
          <div className="flex items-center gap-2">
            {syncStatus === 'synced' && (
              <button onClick={fetchInterventions} title="Synchronisé - Cliquez pour rafraîchir">
                <Cloud size={20} className="text-emerald-400 hover:text-emerald-300 transition-colors" />
              </button>
            )}
            {syncStatus === 'syncing' && <RefreshCw size={20} className="text-amber-500 animate-spin" title="Synchronisation..." />}
            {syncStatus === 'error' && (
              <button onClick={fetchInterventions} title="Erreur - Cliquez pour réessayer">
                <CloudOff size={20} className="text-red-400 hover:text-red-300 transition-colors" />
              </button>
            )}
            {syncStatus === 'offline' && <CloudOff size={20} className="text-slate-400" title="Mode hors-ligne" />}
          </div>
        </div>
      </div>
      <div className="p-8">
      <div className="space-y-6 pb-2">
        <button 
          onClick={() => openForm()} 
          className="w-full text-left px-6 py-5 bg-amber-400 text-black font-black rounded-xl flex items-center justify-between border-2 border-amber-500 shadow-[0_6px_0_0_#d97706] hover:bg-amber-300 hover:shadow-[0_4px_0_0_#d97706] hover:translate-y-[2px] active:shadow-[0_0px_0_0_#d97706] active:translate-y-[6px] transition-all duration-150 uppercase tracking-tight"
        >
          Saisie des bons d'interventions <span className="text-2xl">→</span>
        </button>
        <button 
          onClick={() => setView('consultation')} 
          className="w-full text-left px-6 py-5 bg-slate-800 text-white font-black rounded-xl flex items-center justify-between border-2 border-slate-900 shadow-[0_6px_0_0_#0f172a] hover:bg-slate-700 hover:shadow-[0_4px_0_0_#0f172a] hover:translate-y-[2px] active:shadow-[0_0px_0_0_#0f172a] active:translate-y-[6px] transition-all duration-150 uppercase tracking-tight"
        >
          Consultation des interventions <span className="text-2xl">→</span>
        </button>
        <button 
          onClick={() => {
            setSearchQuery("");
            setSearchStartDate("");
            setSearchEndDate(getTodayFormatted());
            setView('recherche');
          }} 
          className="w-full text-left px-6 py-5 bg-slate-100 text-slate-800 font-black rounded-xl flex items-center justify-between border-2 border-slate-300 shadow-[0_6px_0_0_#94a3b8] hover:bg-slate-200 hover:shadow-[0_4px_0_0_#94a3b8] hover:translate-y-[2px] active:shadow-[0_0px_0_0_#94a3b8] active:translate-y-[6px] transition-all duration-150 uppercase tracking-tight"
        >
          Recherche d'intervention <span className="text-2xl">→</span>
        </button>
        <button 
          onClick={() => setView('stats')} 
          className="w-full text-left px-6 py-5 bg-zinc-800 text-white font-black rounded-xl flex items-center justify-between border-2 border-zinc-900 shadow-[0_6px_0_0_#18181b] hover:bg-zinc-700 hover:shadow-[0_4px_0_0_#18181b] hover:translate-y-[2px] active:shadow-[0_0px_0_0_#18181b] active:translate-y-[6px] transition-all duration-150 uppercase tracking-tight"
        >
          Statistiques <span className="text-2xl">→</span>
        </button>
      </div>
      <div className="mt-8 pt-4 border-t border-slate-200 flex justify-center">
        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Système Industriel v2.5</p>
      </div>
      </div>
    </div>
  );

  const renderSaisie = () => {
    const isArchived = Boolean(formData.signature);

    return (
    <div className="w-full max-w-4xl bg-[#415A77] shadow-2xl border border-slate-500 rounded-lg">
      <header className="sticky top-0 z-50 bg-[#1B263B] text-white p-4 md:p-6 flex flex-col sm:flex-row gap-4 justify-between items-center text-center sm:text-left border-b-4 border-amber-500 shadow-md">
        <div className="flex w-full sm:w-auto justify-between sm:justify-start items-center gap-4">
          <button onClick={() => setView('menu')} className="text-slate-400 hover:text-amber-500 font-bold text-sm transition-colors">← MENU</button>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tighter uppercase leading-tight">
              {isArchived ? "Consultation d'un bon d'intervention" : "Saisie d'un bon d'intervention"}
            </h1>
            <p className="text-[10px] md:text-xs text-amber-500 font-black uppercase tracking-widest">Maintenance Control</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-center sm:justify-end">
           {!currentId && (
             <>
               {/* Input with capture specifically for Camera */}
               <input type="file" accept="image/*" capture="environment" onChange={(e) => {
                 if (e.target.files && e.target.files.length > 0) {
                   processImage(e.target.files[0]);
                 }
               }} className="hidden" id="photo-upload-camera" />
               
               {/* Input without capture specifically for Gallery */}
               <input type="file" accept="image/*" onChange={(e) => {
                 if (e.target.files && e.target.files.length > 0) {
                   processImage(e.target.files[0]);
                 }
               }} className="hidden" id="photo-upload-gallery" />
               
               <div className="flex gap-2 w-full sm:w-auto">
                 <label htmlFor="photo-upload-camera" className={`flex-1 sm:flex-none cursor-pointer bg-white/10 hover:bg-white/20 active:scale-95 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-white/20 transition-all ${isExtracting ? 'opacity-50 pointer-events-none' : ''}`}>
                   <span className="text-lg">📷</span>
                   {isExtracting ? (extractStep || '...') : 'Photo'}
                 </label>
                 <label htmlFor="photo-upload-gallery" className={`flex-1 sm:flex-none cursor-pointer bg-white/10 hover:bg-white/20 active:scale-95 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-white/20 transition-all ${isExtracting ? 'opacity-50 pointer-events-none' : ''}`}>
                   <span className="text-lg">🖼️</span>
                   {isExtracting ? '...' : 'Galerie'}
                 </label>
               </div>
             </>
           )}
           {!isArchived && (
             <button onClick={handleSave} className="flex-1 sm:flex-none bg-amber-500 hover:bg-amber-400 active:scale-95 text-black px-6 py-2 rounded font-black uppercase tracking-tight shadow-xl shadow-amber-500/20 transition-all border-b-4 border-amber-700 hover:border-amber-600 active:border-b-0">Sauvegarder</button>
           )}
        </div>
      </header>
      
      {extractionError && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 m-4" role="alert">
          <p className="font-bold">Erreur d'analyse</p>
          <p className="text-sm">{extractionError}</p>
        </div>
      )}

      <form className="p-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-xs font-black text-white border-b-2 border-amber-500 pb-1 mb-3 uppercase tracking-wider">Données Administratives</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase">Colmar le</label>
                <input name="dateSaisie" value={formData.dateSaisie} onChange={handleChange} disabled={isArchived} type="date" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-900 disabled:opacity-75" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase">N° de bon</label>
                <input name="numeroBon" value={formData.numeroBon} onChange={handleChange} disabled={isArchived} type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-900 font-bold disabled:opacity-75" />
              </div>
            </div>
            <h3 className="text-xs font-black text-white border-b-2 border-amber-500 pb-1 mb-3 uppercase tracking-wider">Informations Demandeur</h3>
            <div>
              <label className="block text-[10px] font-bold text-slate-300 uppercase">Demandeur</label>
              <input name="demandeur" value={formData.demandeur} onChange={handleChange} disabled={isArchived} type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-900 disabled:opacity-75" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-300 uppercase">Référence Bâtiment</label>
              <input name="refBatiment" value={formData.refBatiment} onChange={handleChange} disabled={isArchived} type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-900 disabled:opacity-75" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase">Date de demande</label>
                <input 
                  name="dateDemande" 
                  value={formData.dateDemande} 
                  min={formData.dateSaisie} 
                  onChange={handleChange} 
                  onFocus={() => {
                    if (!formData.dateDemande && formData.dateSaisie) {
                      setFormData(prev => ({ ...prev, dateDemande: formData.dateSaisie }));
                    }
                  }}
                  type="date" 
                  disabled={isArchived}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-900 disabled:opacity-75" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">Date de devis</label>
                <div className="flex items-center gap-3">
                  <div className="flex-grow max-w-[160px]">
                    <input 
                      name="dateDevis" 
                      value={formData.dateDevis} 
                      min={formData.dateDemande || formData.dateSaisie} 
                      onChange={handleChange} 
                      onFocus={() => {
                        const fallbackDate = formData.dateDemande || formData.dateSaisie;
                        if (!formData.dateDevis && fallbackDate) {
                          setFormData(prev => ({ ...prev, dateDevis: fallbackDate }));
                        }
                      }}
                      type="date" 
                      disabled={isArchived}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-900 disabled:opacity-75" 
                    />
                  </div>
                  
                  <div className="flex-shrink-0">
                    <input 
                      type="file" 
                      ref={devisInputRef}
                      onChange={handleDevisPhotos}
                      accept="image/*" 
                      capture="environment"
                      multiple 
                      className="hidden" 
                    />
                    {formData.urlDevis ? (
                      <div className="flex items-center gap-2">
                        <a 
                          href={formData.urlDevis} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-3 py-2 rounded uppercase flex items-center gap-2 transition-colors shadow-sm"
                        >
                          <FileText size={14} /> Voir Devis
                        </a>
                        {!isArchived && (
                          <button
                            type="button"
                            onClick={removeDevis}
                            className="p-2 text-red-500 hover:text-red-700 transition-colors"
                            title="Supprimer le devis"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    ) : pendingDevisPhotos.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => devisInputRef.current?.click()}
                            disabled={isUploadingDevis || isArchived}
                            className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black px-2 py-2 rounded uppercase flex items-center gap-1 transition-colors shadow-sm"
                          >
                            <Camera size={14} /> + Page
                          </button>
                          <button
                            type="button"
                            onClick={generateFinalDevisPDF}
                            disabled={isUploadingDevis || isArchived}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-2 py-2 rounded uppercase flex items-center gap-1 transition-colors shadow-sm"
                          >
                            {isUploadingDevis ? <Loader2 size={14} className="animate-spin" /> : "OK (" + pendingDevisPhotos.length + ")"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDevisPhotos([])}
                            disabled={isUploadingDevis || isArchived}
                            className="text-white/50 hover:text-white p-1"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <p className="text-[9px] text-white/70 font-bold uppercase italic text-center">
                          {pendingDevisPhotos.length} page(s) en attente
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => devisInputRef.current?.click()}
                          disabled={isUploadingDevis || isArchived}
                          className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black px-3 py-2 rounded uppercase flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                        >
                          {isUploadingDevis ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                          {isUploadingDevis ? 'Traitement...' : 'Photo Devis'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-xs font-black text-white border-b-2 border-amber-500 pb-1 mb-3 uppercase tracking-wider">Localisation</h3>
            <div>
              <label className="block text-[10px] font-bold text-slate-300 uppercase">Lieu</label>
              <input name="lieu" value={formData.lieu} onChange={handleChange} disabled={isArchived} type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-900 disabled:opacity-75" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase">Étage</label>
                <input name="etage" value={formData.etage} onChange={handleChange} disabled={isArchived} type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-900 disabled:opacity-75" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase">Pièce</label>
                <input name="piece" value={formData.piece} onChange={handleChange} disabled={isArchived} type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-900 disabled:opacity-75" />
              </div>
            </div>
          </div>
          <div className="md:col-span-2">
            {/* Signature moved below */}
          </div>
        </section>

        <section className="border-t border-slate-200 pt-8 mt-8">
          <h3 className="text-xs font-black text-white border-b-2 border-amber-500 pb-1 mb-3 uppercase tracking-wider">Détails de l'Intervention</h3>
          <div className="mb-4">
            <label className="block text-[10px] font-bold text-slate-300 uppercase">Demande</label>
            <input name="demande" value={formData.demande} onChange={handleChange} disabled={isArchived} type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-900 font-bold disabled:opacity-75" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-300 uppercase">Description de l'intervention</label>
            <textarea name="description" value={formData.description} onChange={handleChange} disabled={isArchived} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-900 h-24 resize-none disabled:opacity-75" />
          </div>
        </section>

        {currentId && (
          <section className="border-t border-slate-200 pt-8 mt-8">
            <div className="flex justify-between items-center border-b-2 border-amber-500 pb-1 mb-3">
              <h3 className="text-xs font-black text-white uppercase tracking-wider">Retour de fiche / Passages</h3>
              {formData.passages && formData.passages.length > 0 && !isArchived && (
                 <button type="button" onClick={addPassage} className="text-xs font-black text-amber-600 hover:text-amber-700 uppercase tracking-tighter">
                   + Ajouter un passage
                 </button>
              )}
            </div>
            
            <div className="space-y-6">
              {formData.passages?.map((passage: any, index: number) => (
                <div key={passage.id} className="bg-white text-slate-900/50 p-4 rounded border border-slate-200 relative">
                  <div className="absolute top-4 right-4">
                     {formData.passages.length > 1 && !isArchived && (
                       <button type="button" onClick={() => removePassage(passage.id)} className="text-red-500 hover:text-red-700" aria-label="Supprimer ce passage">
                         <Trash2 size={16} />
                       </button>
                     )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-700 mb-4">Intervention #{index + 1}</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-300 uppercase">Date d'intervention</label>
                      <input 
                        type="date" 
                        value={passage.dateExecution} 
                        disabled={isArchived}
                        min={formData.dateSaisie} 
                        onChange={(e) => handlePassageChange(passage.id, 'dateExecution', e.target.value)} 
                        onFocus={() => { if (!passage.dateExecution && formData.dateSaisie) handlePassageChange(passage.id, 'dateExecution', formData.dateSaisie) }} 
                        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white disabled:opacity-75" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-300 uppercase">Temps passé</label>
                      <input 
                        list="temps-passe-list" 
                        value={passage.tempsPasse} 
                        disabled={isArchived}
                        onChange={(e) => handlePassageChange(passage.id, 'tempsPasse', e.target.value)} 
                        type="text" 
                        placeholder="ex: 02h30" 
                        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white font-bold disabled:opacity-75" 
                      />
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-[10px] font-bold text-slate-300 uppercase">Nom de l'intervenant</label>
                    <select 
                      value={passage.nomIntervenant} 
                      disabled={isArchived}
                      onChange={(e) => handlePassageChange(passage.id, 'nomIntervenant', e.target.value)} 
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white font-bold disabled:opacity-75"
                    >
                      <option value="Christophe Meyer">Christophe Meyer</option>
                      <option value="Autre">Autre...</option>
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="block text-[10px] font-bold text-slate-300 uppercase">Travaux réalisés</label>
                    <textarea 
                      value={passage.travauxRealises} 
                      disabled={isArchived}
                      onChange={(e) => handlePassageChange(passage.id, 'travauxRealises', e.target.value)} 
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white h-24 resize-none disabled:opacity-75" 
                    />
                  </div>
                  
                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                       <input 
                         type="checkbox" 
                         id={`nouveauPassage-${passage.id}`} 
                         checked={passage.nouveauPassageRequis} 
                         disabled={isArchived}
                         onChange={(e) => handlePassageChange(passage.id, 'nouveauPassageRequis', e.target.checked)} 
                         className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer disabled:opacity-75" 
                       />
                       <label htmlFor={`nouveauPassage-${passage.id}`} className="text-sm font-bold text-slate-700 cursor-pointer">
                         Obligation d'un autre passage ?
                       </label>
                    </div>
                    {passage.nouveauPassageRequis && (
                      <div className="bg-white p-4 rounded border border-slate-200 mt-3 space-y-3 shadow-sm">
                         <div>
                           <label className="block text-[10px] font-bold text-slate-300 uppercase">Raison de ce nouveau passage</label>
                           <select 
                             value={passage.raisonNouveauPassage} 
                             disabled={isArchived}
                             onChange={(e) => handlePassageChange(passage.id, 'raisonNouveauPassage', e.target.value)} 
                             className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-900 font-bold disabled:opacity-75"
                           >
                              <option value="Demande de devis">Demande de devis</option>
                              <option value="Pièce(s) manquante(s)">Pièce(s) manquante(s)</option>
                              <option value="Manque de temps">Manque de temps</option>
                              <option value="Intervention d'une autre entreprise nécessaire">Intervention d'une autre entreprise nécessaire</option>
                              <option value="Autre">Autre...</option>
                           </select>
                         </div>
                         {passage.raisonNouveauPassage === 'Autre' && (
                           <div>
                             <label className="block text-[10px] font-bold text-slate-300 uppercase">Précisez la raison</label>
                             <input 
                               type="text" 
                               value={passage.autreRaison} 
                               disabled={isArchived}
                               onChange={(e) => handlePassageChange(passage.id, 'autreRaison', e.target.value)} 
                               className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-amber-500 outline-none bg-white text-slate-900 disabled:opacity-75" 
                             />
                           </div>
                         )}
                      </div>
                    )}
                  </div>

                </div>
              ))}
            </div>

            <datalist id="temps-passe-list">
              <option value="01h00" />
              <option value="02h00" />
              <option value="03h00" />
              <option value="04h00" />
              <option value="05h00" />
              <option value="06h00" />
              <option value="07h00" />
              <option value="08h00" />
            </datalist>
          </section>
        )}

        <section className="border-t border-slate-200 pt-8">
          <div className="mb-6">
            <label className="block text-[10px] font-bold text-slate-300 uppercase">Atelier</label>
            <input name="atelier" value={formData.atelier} onChange={handleChange} disabled={isArchived} type="text" className="w-full md:w-1/2 border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white text-slate-900 disabled:opacity-75" />
          </div>
          {currentId && (
            <div 
              onClick={() => !isArchived && setSigningId(currentId)}
              className={`bg-white text-slate-900 p-4 rounded border border-slate-200 transition-colors flex flex-col items-center justify-center min-h-[120px] ${isArchived ? 'cursor-default' : 'hover:bg-slate-100 cursor-pointer'}`}
            >
              {formData.signature ? (
                <div className="flex flex-col items-center">
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-2">Signature enregistrée</label>
                  <img src={formData.signature} alt="Signature" className="h-24 w-48 border border-slate-300 rounded bg-white" />
                </div>
              ) : (
                <div className="text-center text-slate-300">
                  <svg className="mx-auto h-8 w-8 mb-2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <p className="text-sm font-bold uppercase tracking-wider">Cliquer ici pour signer</p>
                </div>
              )}
            </div>
          )}
        </section>
      </form>

      {signingId && (
        <div className="fixed inset-0 bg-slate-900/50 flex flex-col items-center justify-center p-6 z-[100]">
          <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center">
            <h2 className="text-lg font-bold mb-4">Signature</h2>
            <SignatureCanvas ref={sigCanvas} penColor='black' canvasProps={{width: 300, height: 150, className: 'border border-slate-300 rounded bg-white text-slate-900'}} />
            <div className="flex gap-4 mt-4">
              <button type="button" onClick={() => setSigningId(null)} className="bg-slate-200 px-4 py-2 rounded font-bold hover:bg-slate-300 transition-colors">Annuler</button>
              <button type="button" onClick={() => sigCanvas.current?.clear()} className="bg-slate-200 px-4 py-2 rounded font-bold hover:bg-slate-300 transition-colors">Effacer</button>
              <button type="button" onClick={() => saveSignature(signingId)} className="bg-slate-900 text-white px-4 py-2 rounded font-bold hover:bg-slate-800 transition-colors">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}
    </div>
    );
  };

  const deleteIntervention = async (id: string) => {
    if (window.confirm("Voulez-vous vraiment supprimer cette intervention ?")) {
      setInterventions(interventions.filter((i: any) => i.id !== id));
      if (import.meta.env.VITE_SUPABASE_URL) {
        setSyncStatus('syncing');
        try {
          await supabase.from('interventions').delete().eq('id', id);
          setSyncStatus('synced');
        } catch (e) {
          setSyncStatus('error');
        }
      }
    }
  };

  const saveSignature = (id: string) => {
    if (sigCanvas.current) {
      const signature = sigCanvas.current.toDataURL();
      const dateSignature = getTodayFormatted();
      const updatedInterventions = interventions.map((i: any) => i.id === id ? { ...i, signature, dateSignature } : i);
      setInterventions(updatedInterventions);
      
      const updatedItem = updatedInterventions.find((i: any) => i.id === id);
      if (updatedItem) {
        syncIntervention(updatedItem);
      }
      
      // Update formData if it is the currently edited intervention
      if (currentId === id) {
        setFormData(prev => ({ ...prev, signature, dateSignature }));
      }
      
      setSigningId(null);
    }
  };

  const renderConsultation = () => {
    const displayedInterventions = interventions.filter((i: any) => 
      consultationTab === 'enCours' ? !i.signature : i.signature
    );
    
    return (
      <div className="w-full max-w-4xl bg-[#415A77] shadow-2xl border border-slate-500 rounded-lg relative">
        <header className="sticky top-0 z-50 bg-[#1B263B] text-white p-4 md:p-6 border-b-4 border-amber-500 shadow-md">
          <div className="flex justify-between items-center">
            <div>
              <button onClick={() => setView('menu')} className="text-slate-400 hover:text-amber-500 font-bold text-sm mb-1 transition-colors block">← MENU</button>
              <h1 className="text-2xl font-black uppercase tracking-tighter">Consultation</h1>
            </div>
            <div className="text-right">
               <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest">Archive & Suivi</p>
            </div>
          </div>
        </header>
        <div className="p-8">
        
        <div className="flex gap-2 mb-6 border-b border-slate-200 pb-4">
          <button 
            onClick={() => setConsultationTab('enCours')}
            className={`px-4 py-2 rounded font-black text-xs uppercase tracking-widest transition-colors ${consultationTab === 'enCours' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Interventions en cours
          </button>
          <button 
            onClick={() => setConsultationTab('archivees')}
            className={`px-4 py-2 rounded font-black text-xs uppercase tracking-widest transition-colors ${consultationTab === 'archivees' ? 'bg-slate-800 text-white shadow-lg shadow-slate-800/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Interventions archivées
          </button>
        </div>

        <div className="space-y-4">
          {displayedInterventions.map((i: any) => (
            <div key={i.id} className={`w-full p-4 rounded border ${i.signature ? 'bg-slate-100 border-slate-300' : 'bg-white text-slate-900 border-slate-200'}`}>
              <div className='flex justify-between items-center mb-2'>
                <button 
                  onClick={() => openForm(i)} 
                  className={`flex-grow font-bold text-left transition-colors ${i.signature ? 'text-slate-700 hover:text-slate-900' : 'text-slate-900 hover:text-amber-600'}`}
                >
                  <div className={`text-base ${isDateOlderThan30Days(i.dateDevis, i.dateSignature) ? 'text-red-600' : ''}`}>
                    {i.numeroBon ? `Bon n°${i.numeroBon} - ` : ''}{i.lieu} - {i.demande || 'Sans titre'}
                    {isDateOlderThan30Days(i.dateDevis, i.dateSignature) && (
                      <span className="inline-block bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded ml-2 uppercase tracking-wider align-middle">
                        En retard (+{getDaysElapsed(i.dateDevis, i.dateSignature)}j)
                      </span>
                    )}
                  </div>
                  {i.passages && i.passages.length > 1 ? (
                    <div className="text-xs text-slate-500 font-normal mt-1">Intervenants : {i.passages.length} passages enregistrés</div>
                  ) : (i.nomIntervenant && (
                    <div className="text-xs text-slate-500 font-normal mt-1">Intervenant : {i.nomIntervenant} {i.tempsPasse && `(${i.tempsPasse})`}</div>
                  ))}
                  {i.signature && (
                    <div className="text-[10px] font-bold text-emerald-600 mt-2 uppercase">✓ Document signé</div>
                  )}
                </button>
                <div className='flex gap-2'>
                  <button onClick={() => deleteIntervention(i.id)} className="text-red-600 hover:text-red-800 p-2" aria-label="Supprimer">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {displayedInterventions.length === 0 && (
            <p className="text-slate-300 italic">
              {consultationTab === 'enCours' 
                ? "Aucune intervention active (non signée) enregistrée." 
                : "Aucune intervention archivée (signée) pour le moment."}
            </p>
          )}
        </div>
        </div>
      </div>
    );
  };

  const renderRecherche = () => {
    const uniqueBons = Array.from(new Set(interventions.map((i: any) => i.numeroBon).filter(Boolean)));
    const isSearching = Boolean(searchQuery || searchStartDate || searchEndDate);

    const filteredInterventions = interventions.filter((i: any) => {
      const matchBon = !searchQuery || (i.numeroBon && i.numeroBon.toLowerCase().includes(searchQuery.toLowerCase()));
      
      let matchDate = true;
      if (searchStartDate || searchEndDate) {
        const d = i.dateSaisie;
        if (!d) {
          matchDate = false;
        } else {
          if (searchStartDate && d < searchStartDate) matchDate = false;
          if (searchEndDate && d > searchEndDate) matchDate = false;
        }
      }

      return matchBon && matchDate;
    });

    return (
      <div className="w-full max-w-4xl bg-[#415A77] shadow-2xl border border-slate-500 rounded-lg relative">
        <header className="sticky top-0 z-50 bg-[#1B263B] text-white p-4 md:p-6 border-b-4 border-amber-500 shadow-md">
          <div className="flex justify-between items-center">
            <div>
              <button onClick={() => setView('menu')} className="text-slate-400 hover:text-amber-500 font-bold text-sm mb-1 transition-colors block">← MENU</button>
              <h1 className="text-2xl font-black uppercase tracking-tighter">Recherche</h1>
            </div>
            <div className="text-right">
               <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest">Base de données</p>
            </div>
          </div>
        </header>
        <div className="p-8">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-slate-300 uppercase mb-2">Recherche par N° de bon</label>
            <input 
              type="text" 
              list="bon-list"
              placeholder="Entrez ou sélectionnez un N° de bon..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full border border-slate-300 rounded px-4 py-2 text-base focus:ring-2 focus:ring-amber-500 outline-none bg-white font-bold"
            />
            <datalist id="bon-list">
              {uniqueBons.map((bon: any) => (
                <option key={bon} value={bon} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-300 uppercase mb-2">Date saisie (À partir du)</label>
            <input 
              type="date" 
              value={searchStartDate} 
              onChange={(e) => setSearchStartDate(e.target.value)} 
              className="w-full border border-slate-300 rounded px-4 py-2 text-base focus:ring-2 focus:ring-amber-500 outline-none bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-300 uppercase mb-2">Date saisie (Jusqu'au)</label>
            <input 
              type="date" 
              value={searchEndDate} 
              onChange={(e) => setSearchEndDate(e.target.value)} 
              className="w-full border border-slate-300 rounded px-4 py-2 text-base focus:ring-2 focus:ring-amber-500 outline-none bg-white"
            />
          </div>
        </div>

        <div className="space-y-4">
          {isSearching && filteredInterventions.length === 0 && (
             <p className="text-slate-300 italic">Aucune intervention trouvée pour ces critères.</p>
          )}
          {(!isSearching) && (
            <p className="text-slate-300 italic">Veuillez entrer un numéro de bon ou une plage de dates pour lancer la recherche.</p>
          )}
          {isSearching && filteredInterventions.map((i: any) => (
            <div key={i.id} className={`w-full p-4 rounded border ${i.signature ? 'bg-slate-100 border-slate-300' : 'bg-white text-slate-900 border-slate-200'}`}>
              <div className='flex justify-between items-center mb-2'>
                <button 
                  onClick={() => openForm(i)} 
                  className={`flex-grow font-bold text-left transition-colors ${i.signature ? 'text-slate-700 hover:text-slate-900' : 'text-slate-900 hover:text-amber-600'}`}
                >
                  <div className={`text-base ${isDateOlderThan30Days(i.dateDevis, i.dateSignature) ? 'text-red-600' : ''}`}>
                    {i.numeroBon ? `Bon n°${i.numeroBon} - ` : ''}{i.lieu} - {i.demande || 'Sans titre'}
                    {isDateOlderThan30Days(i.dateDevis, i.dateSignature) && (
                      <span className="inline-block bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded ml-2 uppercase tracking-wider align-middle">
                        En retard (+{getDaysElapsed(i.dateDevis, i.dateSignature)}j)
                      </span>
                    )}
                  </div>
                  {i.passages && i.passages.length > 1 ? (
                    <div className="text-xs text-slate-500 font-normal mt-1">Intervenants : {i.passages.length} passages enregistrés</div>
                  ) : (i.nomIntervenant && (
                    <div className="text-xs text-slate-500 font-normal mt-1">Intervenant : {i.nomIntervenant} {i.tempsPasse && `(${i.tempsPasse})`}</div>
                  ))}
                  {i.signature && (
                    <div className="text-[10px] font-bold text-emerald-600 mt-2 uppercase">✓ Document signé</div>
                  )}
                </button>
                <div className='flex gap-2'>
                  <button onClick={() => deleteIntervention(i.id)} className="text-red-600 hover:text-red-800 p-2" aria-label="Supprimer">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>
    );
  };

  const renderStats = () => {
    const filtered = interventions.filter((i: any) => {
      const date = i.dateSaisie || "";
      if (!date) return false;
      if (statsFilter === 'year') {
        return date.startsWith(statsYear);
      } else if (statsFilter === 'month') {
        return date.startsWith(`${statsYear}-${statsMonth}`);
      } else {
        if (!statsStart || !statsEnd) return true;
        return date >= statsStart && date <= statsEnd;
      }
    });

    const years = Array.from(new Set(interventions.map((i: any) => (i.dateSaisie || "").substring(0, 4)).filter(Boolean))).sort().reverse();

    return (
      <div className="w-full max-w-4xl bg-[#415A77] shadow-2xl border border-slate-500 rounded-lg relative">
        <header className="sticky top-0 z-50 bg-[#1B263B] text-white p-4 md:p-6 border-b-4 border-amber-500 shadow-md">
          <div className="flex justify-between items-center">
            <div>
              <button onClick={() => setView('menu')} className="text-slate-400 hover:text-amber-500 font-bold text-sm mb-1 transition-colors block">← MENU</button>
              <h1 className="text-2xl font-black uppercase tracking-tighter">Statistiques</h1>
            </div>
            <div className="text-right">
               <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest">Reporting Analytique</p>
            </div>
          </div>
        </header>

        <div className="p-8">
          <div className="bg-[#1B263B]/30 p-6 rounded-xl border border-white/10 mb-8 space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-300 uppercase mb-3">Filtrer les statistiques par :</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'year', label: 'Par Année' },
                  { id: 'month', label: 'Par Mois' },
                  { id: 'range', label: 'Par Date' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStatsFilter(f.id as any)}
                    className={`px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all ${statsFilter === f.id ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
              {(statsFilter === 'year' || statsFilter === 'month') && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-2">Choisir l'année</label>
                  <select 
                    value={statsYear} 
                    onChange={(e) => setStatsYear(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white font-bold"
                  >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                    {!years.includes(new Date().getFullYear().toString()) && <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>}
                  </select>
                </div>
              )}
              {statsFilter === 'month' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-2">Choisir le mois</label>
                  <select 
                    value={statsMonth} 
                    onChange={(e) => setStatsMonth(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white font-bold"
                  >
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                      <option key={m} value={m}>{new Date(2000, parseInt(m)-1).toLocaleString('fr-FR', { month: 'long' }).toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              )}
              {statsFilter === 'range' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 uppercase mb-2">Début</label>
                    <input type="date" value={statsStart} onChange={(e) => setStatsStart(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 uppercase mb-2">Fin</label>
                    <input type="date" value={statsEnd} onChange={(e) => setStatsEnd(e.target.value)} className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white" />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto bg-white rounded-xl shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest">
                  <th className="px-4 py-4">N° Bon</th>
                  <th className="px-4 py-4">Temps Cumulé</th>
                  <th className="px-4 py-4">État / Retard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((i: any) => {
                  const totalMinutes = (i.passages || []).reduce((acc: number, p: any) => acc + parseDuration(p.tempsPasse), 0);
                  const delay = getDaysElapsed(i.dateDevis, i.dateSignature);
                  const isLate = isDateOlderThan30Days(i.dateDevis, i.dateSignature);

                  return (
                    <tr key={i.id} className={`hover:bg-slate-50 transition-colors ${isLate ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-4">
                        <button 
                          onClick={() => openForm(i)}
                          className="text-amber-600 hover:text-amber-700 font-black underline decoration-2 underline-offset-4"
                        >
                          {i.numeroBon || "VOIR"}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-sm font-black text-slate-700">
                        {formatDuration(totalMinutes)}
                      </td>
                      <td className="px-4 py-4">
                        {isLate ? (
                          <span className="inline-block px-2 py-1 bg-red-600 text-white text-[10px] font-black rounded uppercase">
                            RETARD +{delay}j
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded uppercase">
                            CONFORME
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center text-slate-400 italic">
                      Aucune donnée trouvée pour cette période.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#415A77] p-6 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto">
        {view === 'menu' && renderMenu()}
        {view === 'saisie' && renderSaisie()}
        {view === 'consultation' && renderConsultation()}
        {view === 'recherche' && renderRecherche()}
        {view === 'stats' && renderStats()}
      </div>
    </div>
  );
}
