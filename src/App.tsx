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
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { Trash2 } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

// Déclaration pour TypeScript
declare global {
  const __APP_GEMINI_KEY__: string;
}

// Détection de la clé API (Injection forcée via Vite)
const API_KEY = typeof __APP_GEMINI_KEY__ !== 'undefined' ? __APP_GEMINI_KEY__ : "";
let ai: any = null;

if (API_KEY) {
  try {
    ai = new GoogleGenAI({ 
      apiKey: API_KEY,
      apiVersion: 'v1'
    });
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

export default function App() {
  const [view, setView] = useState<'menu' | 'saisie' | 'consultation' | 'recherche'>(() => {
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
  const sigCanvas = useRef<any>(null);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePassageChange = (id: string, field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      passages: prev.passages.map((p: any) => p.id === id ? { ...p, [field]: value } : p)
    }));
  };

  const addPassage = () => {
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
    setFormData((prev: any) => ({
      ...prev,
      passages: prev.passages.filter((p: any) => p.id !== id)
    }));
  };

  const handleSave = () => {
    let dataToSave = { ...formData };
    if (dataToSave.passages && dataToSave.passages.length > 0) {
      dataToSave.dateExecution = dataToSave.passages[0].dateExecution;
      dataToSave.nomIntervenant = dataToSave.passages[0].nomIntervenant;
      dataToSave.tempsPasse = dataToSave.passages[0].tempsPasse;
      dataToSave.travauxRealises = dataToSave.passages[0].travauxRealises;
    }

    if (currentId) {
      setInterventions(interventions.map((i: any) => i.id === currentId ? { ...dataToSave, id: currentId } : i));
    } else {
      setInterventions([...interventions, { ...dataToSave, id: Date.now().toString() }]);
    }
    setView('menu');
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
      
      if (!ai) {
        throw new Error("L'IA n'est pas configurée. Veuillez ajouter votre VITE_GEMINI_API_KEY dans les paramètres Vercel.");
      }
      
      const fetchPromise = ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            parts: [
              {
                inlineData: { mimeType: mimeType, data: base64 },
              },
              {
                text: "Extract the following fields from this intervention form. IMPORTANT: For dates (dateSaisie, dateExecution, dateDemande, dateDevis), extract the value and convert it strictly into YYYY-MM-DD format. Output the response strictly as a JSON object with these keys: dateSaisie, numeroBon, demandeur, refBatiment, dateDemande, dateDevis, lieu, etage, piece, demande, description, atelier, dateExecution, travauxRealises, tempsPasse, nomIntervenant.",
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      });




      const timeoutPromise = new Promise<GenerateContentResponse>((_, reject) => 
        setTimeout(() => reject(new Error("Le serveur IA met trop de temps à répondre (Time-Out). Vérifiez votre connexion internet.")), 30000)
      );

      const response = await Promise.race([fetchPromise, timeoutPromise]);
      console.log("[Diagnostic] Réponse reçue de l'IA !");

      if (response.text) {
        let text = response.text.trim();
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
          console.error("JSON Parse Error:", parseError, "Text:", response.text);
          setExtractionError("Erreur de lecture du format de données renvoyé par l'IA.");
        }
      } else {
        console.error("Empty response from AI", response);
        setExtractionError("Erreur technique : Le serveur IA n'a répondu aucun texte.");
      }
    } catch (error: any) {
      console.error("Extraction error:", error);
      setExtractionError(error?.message || "Erreur de connexion lors du traitement.");
    } finally {
      setIsExtracting(false);
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
    <div className="w-full max-w-lg bg-white shadow-xl border border-slate-200 rounded-lg p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-8 border-b border-slate-100 pb-4">Gestion des Interventions</h1>
      <div className="space-y-6 pb-2">
        <button 
          onClick={() => openForm()} 
          className="w-full text-left px-6 py-4 bg-blue-50 text-blue-900 font-bold rounded-xl flex items-center justify-between border-2 border-blue-200 shadow-[0_6px_0_0_#bfdbfe] hover:bg-blue-100 hover:shadow-[0_4px_0_0_#bfdbfe] hover:translate-y-[2px] active:shadow-[0_0px_0_0_#bfdbfe] active:translate-y-[6px] transition-all duration-150"
        >
          Saisie des interventions <span className="text-xl">→</span>
        </button>
        <button 
          onClick={() => setView('consultation')} 
          className="w-full text-left px-6 py-4 bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-between border-2 border-slate-200 shadow-[0_6px_0_0_#cbd5e1] hover:bg-slate-100 hover:shadow-[0_4px_0_0_#cbd5e1] hover:translate-y-[2px] active:shadow-[0_0px_0_0_#cbd5e1] active:translate-y-[6px] transition-all duration-150"
        >
          Consultation des interventions <span className="text-xl">→</span>
        </button>
        <button 
          onClick={() => {
            setSearchQuery("");
            setSearchStartDate("");
            setSearchEndDate(getTodayFormatted());
            setView('recherche');
          }} 
          className="w-full text-left px-6 py-4 bg-emerald-50 text-emerald-900 font-bold rounded-xl flex items-center justify-between border-2 border-emerald-200 shadow-[0_6px_0_0_#a7f3d0] hover:bg-emerald-100 hover:shadow-[0_4px_0_0_#a7f3d0] hover:translate-y-[2px] active:shadow-[0_0px_0_0_#a7f3d0] active:translate-y-[6px] transition-all duration-150"
        >
          Recherche d'intervention <span className="text-xl">→</span>
        </button>
      </div>
    </div>
  );

  const renderSaisie = () => (
    <div className="w-full max-w-4xl bg-white shadow-xl border border-slate-200 rounded-lg overflow-hidden">
      <header className="bg-blue-900 text-white p-4 md:p-6 flex flex-col sm:flex-row gap-4 justify-between items-center text-center sm:text-left">
        <div className="flex w-full sm:w-auto justify-between sm:justify-start items-center gap-4">
          <button onClick={() => setView('menu')} className="text-blue-200 hover:text-white text-sm">← Retour</button>
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight uppercase leading-tight">Saisie d'une demande</h1>
            <p className="text-[10px] md:text-xs text-blue-200 uppercase tracking-widest">Maintenance</p>
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
               
               <div className="flex gap-2 flex-col sm:flex-row w-full">
                 <label htmlFor="photo-upload-camera" className={`flex-1 text-center cursor-pointer bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded text-xs md:text-sm font-bold flex items-center justify-center gap-2 ${isExtracting ? 'opacity-50 pointer-events-none' : ''}`}>
                   <span className="text-lg">📷</span>
                   {isExtracting ? (extractStep || 'Analyse...') : 'Appareil photo'}
                 </label>
                 <label htmlFor="photo-upload-gallery" className={`flex-1 text-center cursor-pointer bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 rounded text-xs md:text-sm font-bold flex items-center justify-center gap-2 ${isExtracting ? 'opacity-50 pointer-events-none' : ''}`}>
                   <span className="text-lg">🖼️</span>
                   {isExtracting ? '...' : 'Photothèque'}
                 </label>
               </div>
             </>
           )}
           <button onClick={handleSave} className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-3 md:px-4 py-2 rounded text-xs md:text-sm font-bold">Sauvegarder</button>
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
            <h3 className="text-xs font-bold text-blue-900 border-b border-blue-100 pb-1 mb-3 uppercase tracking-wider">Données Administratives</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Colmar le</label>
                <input name="dateSaisie" value={formData.dateSaisie} onChange={handleChange} type="date" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-slate-50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">N° de bon</label>
                <input name="numeroBon" value={formData.numeroBon} onChange={handleChange} type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-slate-50" />
              </div>
            </div>
            <h3 className="text-xs font-bold text-blue-900 border-b border-blue-100 pb-1 mb-3 uppercase tracking-wider">Informations Demandeur</h3>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Demandeur</label>
              <input name="demandeur" value={formData.demandeur} onChange={handleChange} type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-slate-50" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Référence Bâtiment</label>
              <input name="refBatiment" value={formData.refBatiment} onChange={handleChange} type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-slate-50" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Date de demande</label>
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
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-slate-50" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Date de devis</label>
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
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-slate-50" 
                />
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-blue-900 border-b border-blue-100 pb-1 mb-3 uppercase tracking-wider">Localisation</h3>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Lieu</label>
              <input name="lieu" value={formData.lieu} onChange={handleChange} type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-slate-50" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Étage</label>
                <input name="etage" value={formData.etage} onChange={handleChange} type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-slate-50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Pièce</label>
                <input name="piece" value={formData.piece} onChange={handleChange} type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-slate-50" />
              </div>
            </div>
          </div>
          <div className="md:col-span-2">
            {/* Signature moved below */}
          </div>
        </section>

        <section className="border-t border-slate-200 pt-8 mt-8">
          <h3 className="text-xs font-bold text-blue-900 border-b border-blue-100 pb-1 mb-3 uppercase tracking-wider">Détails de l'Intervention</h3>
          <div className="mb-4">
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Demande</label>
            <input name="demande" value={formData.demande} onChange={handleChange} type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-slate-50" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Description de l'intervention</label>
            <textarea name="description" value={formData.description} onChange={handleChange} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-slate-50 h-24 resize-none" />
          </div>
        </section>

        {currentId && (
          <section className="border-t border-slate-200 pt-8 mt-8">
            <div className="flex justify-between items-center border-b border-blue-100 pb-1 mb-3">
              <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider">Retour de fiche / Passages</h3>
              {formData.passages && formData.passages.length > 0 && (
                 <button type="button" onClick={addPassage} className="text-xs font-bold text-blue-600 hover:text-blue-800">
                   + Ajouter un passage
                 </button>
              )}
            </div>
            
            <div className="space-y-6">
              {formData.passages?.map((passage: any, index: number) => (
                <div key={passage.id} className="bg-slate-50/50 p-4 rounded border border-slate-200 relative">
                  <div className="absolute top-4 right-4">
                     {formData.passages.length > 1 && (
                       <button type="button" onClick={() => removePassage(passage.id)} className="text-red-500 hover:text-red-700" aria-label="Supprimer ce passage">
                         <Trash2 size={16} />
                       </button>
                     )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-700 mb-4">Intervention #{index + 1}</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Date d'intervention</label>
                      <input 
                        type="date" 
                        value={passage.dateExecution} 
                        min={formData.dateSaisie} 
                        onChange={(e) => handlePassageChange(passage.id, 'dateExecution', e.target.value)} 
                        onFocus={() => { if (!passage.dateExecution && formData.dateSaisie) handlePassageChange(passage.id, 'dateExecution', formData.dateSaisie) }} 
                        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Temps passé</label>
                      <input 
                        list="temps-passe-list" 
                        value={passage.tempsPasse} 
                        onChange={(e) => handlePassageChange(passage.id, 'tempsPasse', e.target.value)} 
                        type="text" 
                        placeholder="ex: 02h30" 
                        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white" 
                      />
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Nom de l'intervenant</label>
                    <select 
                      value={passage.nomIntervenant} 
                      onChange={(e) => handlePassageChange(passage.id, 'nomIntervenant', e.target.value)} 
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                    >
                      <option value="Christophe Meyer">Christophe Meyer</option>
                      <option value="Autre">Autre...</option>
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Travaux réalisés</label>
                    <textarea 
                      value={passage.travauxRealises} 
                      onChange={(e) => handlePassageChange(passage.id, 'travauxRealises', e.target.value)} 
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white h-24 resize-none" 
                    />
                  </div>
                  
                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                       <input 
                         type="checkbox" 
                         id={`nouveauPassage-${passage.id}`} 
                         checked={passage.nouveauPassageRequis} 
                         onChange={(e) => handlePassageChange(passage.id, 'nouveauPassageRequis', e.target.checked)} 
                         className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer" 
                       />
                       <label htmlFor={`nouveauPassage-${passage.id}`} className="text-sm font-bold text-slate-700 cursor-pointer">
                         Obligation d'un autre passage ?
                       </label>
                    </div>
                    {passage.nouveauPassageRequis && (
                      <div className="bg-white p-4 rounded border border-slate-200 mt-3 space-y-3 shadow-sm">
                         <div>
                           <label className="block text-[10px] font-bold text-slate-500 uppercase">Raison de ce nouveau passage</label>
                           <select 
                             value={passage.raisonNouveauPassage} 
                             onChange={(e) => handlePassageChange(passage.id, 'raisonNouveauPassage', e.target.value)} 
                             className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-slate-50"
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
                             <label className="block text-[10px] font-bold text-slate-500 uppercase">Précisez la raison</label>
                             <input 
                               type="text" 
                               value={passage.autreRaison} 
                               onChange={(e) => handlePassageChange(passage.id, 'autreRaison', e.target.value)} 
                               className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-slate-50" 
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
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Atelier</label>
            <input name="atelier" value={formData.atelier} onChange={handleChange} type="text" className="w-full md:w-1/2 border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-slate-50" />
          </div>
          {currentId && (
            <div 
              onClick={() => setSigningId(currentId)}
              className="bg-slate-50 hover:bg-slate-100 cursor-pointer p-4 rounded border border-slate-200 transition-colors flex flex-col items-center justify-center min-h-[120px]"
            >
              {formData.signature ? (
                <div className="flex flex-col items-center">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 cursor-pointer">Signature enregistrée (Cliquer pour modifier)</label>
                  <img src={formData.signature} alt="Signature" className="h-24 w-48 border border-slate-300 rounded bg-white" />
                </div>
              ) : (
                <div className="text-center text-slate-500">
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
            <SignatureCanvas ref={sigCanvas} penColor='black' canvasProps={{width: 300, height: 150, className: 'border border-slate-300 rounded bg-slate-50'}} />
            <div className="flex gap-4 mt-4">
              <button type="button" onClick={() => setSigningId(null)} className="bg-slate-200 px-4 py-2 rounded font-bold">Annuler</button>
              <button type="button" onClick={() => sigCanvas.current?.clear()} className="bg-slate-200 px-4 py-2 rounded font-bold">Effacer</button>
              <button type="button" onClick={() => saveSignature(signingId)} className="bg-blue-600 text-white px-4 py-2 rounded font-bold">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const deleteIntervention = (id: string) => {
    setInterventions(interventions.filter((i: any) => i.id !== id));
  };

  const saveSignature = (id: string) => {
    if (sigCanvas.current) {
      const signature = sigCanvas.current.toDataURL();
      setInterventions(interventions.map((i: any) => i.id === id ? { ...i, signature } : i));
      
      // Update formData if it is the currently edited intervention
      if (currentId === id) {
        setFormData(prev => ({ ...prev, signature }));
      }
      
      setSigningId(null);
    }
  };

  const renderConsultation = () => {
    const displayedInterventions = interventions.filter((i: any) => 
      consultationTab === 'enCours' ? !i.signature : i.signature
    );
    
    return (
      <div className="w-full max-w-4xl bg-white shadow-xl border border-slate-200 rounded-lg p-8 relative">
        <button onClick={() => setView('menu')} className="text-slate-500 hover:text-blue-900 text-sm mb-4">← Retour au menu</button>
        <h1 className="text-2xl font-bold text-blue-900 mb-6 uppercase tracking-tight">Consultation des interventions</h1>
        
        <div className="flex gap-2 mb-6 border-b border-slate-200 pb-4">
          <button 
            onClick={() => setConsultationTab('enCours')}
            className={`px-4 py-2 rounded font-bold text-sm transition-colors ${consultationTab === 'enCours' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Interventions en cours
          </button>
          <button 
            onClick={() => setConsultationTab('archivees')}
            className={`px-4 py-2 rounded font-bold text-sm transition-colors ${consultationTab === 'archivees' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Interventions archivées
          </button>
        </div>

        <div className="space-y-4">
          {displayedInterventions.map((i: any) => (
            <div key={i.id} className={`w-full p-4 rounded border ${i.signature ? 'bg-slate-100 border-slate-300' : 'bg-slate-50 border-slate-200'}`}>
              <div className='flex justify-between items-center mb-2'>
                <button 
                  onClick={() => openForm(i)} 
                  className={`flex-grow font-bold text-left transition-colors ${i.signature ? 'text-slate-700 hover:text-slate-900' : 'text-blue-900 hover:text-blue-700'}`}
                >
                  <div className="text-base">{i.numeroBon ? `Bon n°${i.numeroBon} - ` : ''}{i.lieu} - {i.demande || 'Sans titre'}</div>
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
            <p className="text-slate-500 italic">
              {consultationTab === 'enCours' 
                ? "Aucune intervention active (non signée) enregistrée." 
                : "Aucune intervention archivée (signée) pour le moment."}
            </p>
          )}
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
      <div className="w-full max-w-4xl bg-white shadow-xl border border-slate-200 rounded-lg p-8 relative">
        <button onClick={() => setView('menu')} className="text-slate-500 hover:text-blue-900 text-sm mb-4">← Retour au menu</button>
        <h1 className="text-2xl font-bold text-blue-900 mb-6 uppercase tracking-tight">Recherche d'intervention</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Recherche par N° de bon</label>
            <input 
              type="text" 
              list="bon-list"
              placeholder="Entrez ou sélectionnez un N° de bon..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full border border-slate-300 rounded px-4 py-2 text-base focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
            <datalist id="bon-list">
              {uniqueBons.map((bon: any) => (
                <option key={bon} value={bon} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Date saisie (À partir du)</label>
            <input 
              type="date" 
              value={searchStartDate} 
              onChange={(e) => setSearchStartDate(e.target.value)} 
              className="w-full border border-slate-300 rounded px-4 py-2 text-base focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Date saisie (Jusqu'au)</label>
            <input 
              type="date" 
              value={searchEndDate} 
              onChange={(e) => setSearchEndDate(e.target.value)} 
              className="w-full border border-slate-300 rounded px-4 py-2 text-base focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
          </div>
        </div>

        <div className="space-y-4">
          {isSearching && filteredInterventions.length === 0 && (
             <p className="text-slate-500 italic">Aucune intervention trouvée pour ces critères.</p>
          )}
          {(!isSearching) && (
            <p className="text-slate-500 italic">Veuillez entrer un numéro de bon ou une plage de dates pour lancer la recherche.</p>
          )}
          {isSearching && filteredInterventions.map((i: any) => (
            <div key={i.id} className={`w-full p-4 rounded border ${i.signature ? 'bg-slate-100 border-slate-300' : 'bg-slate-50 border-slate-200'}`}>
              <div className='flex justify-between items-center mb-2'>
                <button 
                  onClick={() => openForm(i)} 
                  className={`flex-grow font-bold text-left transition-colors ${i.signature ? 'text-slate-700 hover:text-slate-900' : 'text-blue-900 hover:text-blue-700'}`}
                >
                  <div className="text-base">{i.numeroBon ? `Bon n°${i.numeroBon} - ` : ''}{i.lieu} - {i.demande || 'Sans titre'}</div>
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
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto">
        {view === 'menu' && renderMenu()}
        {view === 'saisie' && renderSaisie()}
        {view === 'consultation' && renderConsultation()}
        {view === 'recherche' && renderRecherche()}
      </div>
    </div>
  );
}
