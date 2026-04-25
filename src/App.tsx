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
import { Trash2, Cloud, CloudOff, RefreshCw, Camera, FileText, Loader2, X, ChevronDown, ChevronUp, User, MapPin, Settings, ClipboardEdit, ChevronRight, ClipboardList, Database, BarChart3, Lock, ShieldCheck, KeyRound } from 'lucide-react';
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

// Fonction de hachage simple pour le code de protection
const hashPin = async (pin: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export default function App() {
  const [view, setView] = useState<'menu' | 'saisie' | 'consultation' | 'recherche' | 'stats'>(() => {
    return (sessionStorage.getItem('app_view') as any) || 'menu';
  });
  const [consultationTab, setConsultationTab] = useState<'enCours' | 'archivees'>('enCours');
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStartDate, setSearchStartDate] = useState("");
  const [searchEndDate, setSearchEndDate] = useState(() => getTodayFormatted());
  const [interventions, setInterventions] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('interventions');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      // Nettoyage : on ne garde que les objets valides qui ne sont pas des événements
      return parsed.filter(i => i && typeof i === 'object' && i.id && !i.nativeEvent);
    } catch (e) {
      console.error("Erreur critique au chargement du localStorage:", e);
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
      photo_url: "",
      archived: false,
      passages: [{
        id: Date.now().toString(),
        dateExecution: "",
        travauxRealises: "",
        tempsPasse: "",
        nomIntervenant: "Christophe Meyer",
        nouveauPassageRequis: false,
        raisonNouveauPassage: "",
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
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'offline'>('offline');
  const [diagResult, setDiagResult] = useState<string | null>(null);
  const [isUploadingDevis, setIsUploadingDevis] = useState(false);
  const [pendingDevisPhotos, setPendingDevisPhotos] = useState<string[]>([]);
  const [collapsedSections, setCollapsedSections] = useState({
    admin: true,
    demandeur: true,
    localisation: true,
    details: true
  });
  const [statsFilter, setStatsFilter] = useState<'year' | 'month' | 'range'>('year');
  const [statsYear, setStatsYear] = useState(() => new Date().getFullYear().toString());
  const [statsMonth, setStatsMonth] = useState(() => (new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [statsStart, setStatsStart] = useState("");
  const [statsEnd, setStatsEnd] = useState("");
  const sigCanvas = useRef<any>(null);
  const devisInputRef = useRef<HTMLInputElement>(null);
  const passagesRef = useRef<HTMLDivElement>(null);
  const formTopRef = useRef<HTMLDivElement>(null);

  // --- États pour la logique de sauvegarde contextuelle ---
  const [isAiProcessed, setIsAiProcessed] = useState(false);
  const [focusedElement, setFocusedElement] = useState<{ id: string, rect: DOMRect | null }>({ id: "", rect: null });
  const [isHoveringFloatingSave, setIsHoveringFloatingSave] = useState(false);

  // --- États pour la notification furtive ---
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // --- États pour la sécurité ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [isInitializingSecurity, setIsInitializingSecurity] = useState(true);

  useEffect(() => {
    const initSecurity = async () => {
      try {
        const stored = localStorage.getItem('app_pcode');
        if (!stored) {
          // Premier démarrage : on enregistre le code par défaut "135789"
          const hash = await hashPin("135789");
          localStorage.setItem('app_pcode', hash);
          console.log("Sécurité initialisée avec le code par défaut.");
        }
      } catch (e) {
        console.error("Erreur init sécurité:", e);
      } finally {
        setIsInitializingSecurity(false);
      }
    };
    initSecurity();
  }, []);

  const handlePinSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const hash = await hashPin(pinInput);
    const stored = localStorage.getItem('app_pcode');
    
    if (hash === stored) {
      setIsAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput("");
      // Petit effet visuel d'erreur
      setTimeout(() => setPinError(false), 500);
    }
  };

  const handleKeypadPress = (num: string) => {
    if (pinInput.length < 6) {
      const newVal = pinInput + num;
      setPinInput(newVal);
      if (newVal.length === 6) {
        // Auto-submit quand on arrive à 6 chiffres
        setTimeout(() => checkPin(newVal), 100);
      }
    }
  };

  const checkPin = async (val: string) => {
    const hash = await hashPin(val);
    const stored = localStorage.getItem('app_pcode');
    if (hash === stored) {
      setIsAuthenticated(true);
    } else {
      setPinError(true);
      setPinInput("");
      setTimeout(() => setPinError(false), 500);
    }
  };

  useEffect(() => {
    if (view === 'saisie') {
      // Un petit délai pour s'assurer que le DOM est prêt
      setTimeout(() => {
        passagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [view]);

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
        setInterventions(data.map((i: any) => {
          // Si la colonne 'archived' n'existe pas en base, on la calcule à partir des passages
          const hasClosingState = i.passages?.some((p: any) => 
            p.raisonNouveauPassage === 'Terminé' || 
            p.raisonNouveauPassage === "Intervention d'une autre entreprise nécessaire"
          );
          return {
            ...i,
            archived: i.archived ?? hasClosingState ?? false
          };
        }));
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
      // On retire 'archived' de l'objet envoyé à Supabase car la colonne n'existe pas
      // L'état archivé sera recalculé au chargement via le contenu des passages
      const { archived, ...dataToSync } = item;
      
      const { error } = await supabase
        .from('interventions')
        .upsert(dataToSync);
      
      if (error) {
        console.error("Erreur Supabase:", error);
        alert(`Erreur de synchronisation : ${error.message}\nCode: ${error.code}`);
        throw error;
      }
      console.log(`[Sync] Succès pour ${item.id} (archivé: ${item.archived})`);
      setSyncStatus('synced');
    } catch (err: any) {
      console.error("Erreur de sauvegarde Supabase:", err);
      setSyncStatus('error');
      // On ne bloque pas l'utilisateur s'il est hors-ligne, mais on le prévient
      if (!window.navigator.onLine) {
        alert("Vous êtes hors-ligne. L'intervention est sauvegardée localement mais ne sera synchronisée qu'une fois la connexion rétablie.");
      }
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
    if (formData.archived) return;
    const { name, value } = e.target;
    const nextData = { ...formData, [name]: value };
    setFormData(nextData);

    // LOGIQUE DE SAUVEGARDE CONTEXTUELLE
    if (isAiProcessed) {
      // Scénario B : Saisie Assistée par IA -> Sauvegarde automatique sur complétion des champs obligatoires
      const mandatoryFields = ['dateSaisie', 'dateDemande', 'numeroBon', 'lieu', 'demande'];
      if (mandatoryFields.includes(name) && value) {
        const isComplete = mandatoryFields.every(f => nextData[f] && nextData[f].trim() !== "");
        if (isComplete) {
          handleSave(nextData);
        }
      }
    }
    // Note : En Scénario A (Manuel), on utilise uniquement le bouton flottant au focus.
  };

  const handlePassageChange = (id: string, field: string, value: any) => {
    if (formData.archived) return;
    setFormData((prev: any) => {
      const newPassages = prev.passages.map((p: any) => p.id === id ? { ...p, [field]: value } : p);
      const currentPassage = newPassages.find((p: any) => p.id === id);
      
      let nextArchived = prev.archived;
      let shouldTriggerSave = false;
      let shouldAddPassage = false;

      // Helper de validation pour l'archivage
      const getMissingFields = (data: any, passage: any) => {
        const missing = [];
        if (!data.numeroBon) missing.push("N° de bon");
        if (!data.lieu) missing.push("Lieu");
        if (!data.demande) missing.push("Demande (Titre)");
        if (!passage?.dateExecution) missing.push("Date d'intervention");
        if (!passage?.tempsPasse) missing.push("Temps passé");
        return missing;
      };

      let finalPassages = newPassages;
      
      // Logique de sauvegarde automatique sans confirmation pour le champ "État / Suite"
      if (field === 'raisonNouveauPassage' && value) {
        const isClosingState = value === 'Terminé' || value === "Intervention d'une autre entreprise nécessaire";
        
        if (isClosingState) {
          const missing = getMissingFields(prev, currentPassage);
          if (missing.length > 0) {
            alert("Champs obligatoires manquants pour la clôture :\n- " + missing.join("\n- "));
          } else {
            // Sauvegarde automatique et archivage
            nextArchived = true;
            shouldTriggerSave = true;
          }
        } else if (value === "Autre passage nécessaire") {
          // On ajoute le nouveau passage DIRECTEMENT dans finalPassages 
          // pour qu'il soit présent dans l'objet nextData envoyé à la sauvegarde
          finalPassages = [...newPassages, {
            id: (Date.now() + 1).toString(),
            dateExecution: "",
            travauxRealises: "",
            tempsPasse: "",
            nomIntervenant: "Christophe Meyer",
            nouveauPassageRequis: false,
            raisonNouveauPassage: "",
            autreRaison: ""
          }];
          shouldTriggerSave = true;
        } else {
          // Pour tout autre état saisi, on sauvegarde automatiquement le brouillon
          shouldTriggerSave = true;
        }
      }

      // Cas particulier : Date d'exécution mise à jour alors que l'état est déjà "Terminé"
      if (field === 'dateExecution' && value && currentPassage?.raisonNouveauPassage === 'Terminé') {
        shouldTriggerSave = true;
      }

      const nextData = {
        ...prev,
        passages: finalPassages,
        archived: nextArchived
      };

      if (shouldTriggerSave) {
        // On sauvegarde immédiatement l'objet contenant TOUTES les modifs (y compris le nouveau passage s'il y a lieu)
        setTimeout(() => handleSave(nextData), 100);
      }

      return nextData;
    });
  };

  const addPassage = () => {
    if (formData.archived) return;
    setFormData((prev: any) => ({
      ...prev,
      passages: [...(prev.passages || []), {
        id: Date.now().toString(),
        dateExecution: "",
        travauxRealises: "",
        tempsPasse: "",
        nomIntervenant: "Christophe Meyer",
        nouveauPassageRequis: false,
        raisonNouveauPassage: "",
        autreRaison: ""
      }]
    }));
  };

  const removePassage = (id: string) => {
    if (formData.archived) return;
    if (!window.confirm("Voulez-vous vraiment supprimer ce passage ?")) return;
    setFormData((prev: any) => ({
      ...prev,
      passages: prev.passages.filter((p: any) => p.id !== id)
    }));
  };

  const handleSave = async (dataOverride: any = null) => {
    try {
      // Éviter de traiter l'objet événement comme des données si appelé via onClick={handleSave}
      const actualData = (dataOverride && dataOverride.nativeEvent) ? null : dataOverride;
      const dataToValidate = actualData || formData;
      console.log("Starting handleSave with data:", dataToValidate);
      
      // Validation: Si un champ du passage est saisi, la date, le temps et l'état deviennent obligatoires
      const passages = dataToValidate.passages || [];
      for (let i = 0; i < passages.length; i++) {
        const p = passages[i];
        const isTouched = p.dateExecution || p.tempsPasse || p.travauxRealises || p.raisonNouveauPassage;
        
        if (isTouched) {
          if (!p.dateExecution) {
            alert(`Passage #${i+1} : Veuillez renseigner la 'Date d'intervention'.`);
            return;
          }
          if (!p.tempsPasse) {
            alert(`Passage #${i+1} : Veuillez renseigner le 'Temps passé'.`);
            return;
          }
          if (!p.raisonNouveauPassage) {
            alert(`Passage #${i+1} : Veuillez sélectionner un 'État / Suite de l'intervention'.`);
            return;
          }
        }
      }

      let dataToSave = { ...dataToValidate };
      if (dataToSave.passages && dataToSave.passages.length > 0) {
        dataToSave.dateExecution = dataToSave.passages[0].dateExecution;
        dataToSave.nomIntervenant = dataToSave.passages[0].nomIntervenant;
        dataToSave.tempsPasse = dataToSave.passages[0].tempsPasse;
        dataToSave.travauxRealises = dataToSave.passages[0].travauxRealises;
      }

      const newId = currentId || Date.now().toString();
      const itemToSync = { 
        ...dataToSave, 
        id: newId,
        archived: Boolean(dataToSave.archived)
      };

      console.log("Item to save:", itemToSync);

      setInterventions((prev: any[]) => {
        if (!Array.isArray(prev)) return [itemToSync];
        if (currentId) {
          return prev.map((i: any) => i.id === currentId ? itemToSync : i);
        } else {
          return [...prev, itemToSync];
        }
      });
      
      if (!currentId) setCurrentId(newId);

      // On attend la fin de la synchronisation avant de quitter
      await syncIntervention(itemToSync);
      
      // L'utilisateur souhaite rester sur la page pour consulter
      showNotification("Sauvegarde automatique effectuée");
      console.log("Save successful, staying on page for consultation");
    } catch (error) {
      console.error("CRITICAL ERROR in handleSave:", error);
      alert("Une erreur est survenue lors de la sauvegarde. Détails: " + (error as Error).message);
    }
  };

  const parseDuration = (d: string) => {
    if (!d) return 0;
    const match = d.match(/(\d+)h(\d+)/i);
    if (match) return parseInt(match[1]) * 60 + parseInt(match[2]);
    const hours = parseInt(d);
    return isNaN(hours) ? 0 : hours * 60;
  };

  const uploadImage = async (file: File | Blob): Promise<string | null> => {
    try {
      const fileName = `photo_${Date.now()}.png`;
      const { data, error } = await supabase.storage
        .from('interventions-photos')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('interventions-photos')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (err) {
      console.error("Erreur d'upload image:", err);
      return null;
    }
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

      setExtractStep("Sauvegarde image...");
      const photoUrl = await uploadImage(processedFile);
      if (photoUrl) {
        setFormData(prev => ({ ...prev, photo_url: photoUrl }));
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

          let finalDataForSave: any = null;

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
            finalDataForSave = newData;
            setIsAiProcessed(true); // Marquage comme traité par IA
            return newData;
          });

          // Vérification des champs obligatoires et sauvegarde automatique
          setTimeout(() => {
            if (finalDataForSave) {
              const missing = [];
              if (!finalDataForSave.dateSaisie) missing.push("'Colmar le'");
              if (!finalDataForSave.dateDemande) missing.push("'Date de demande'");
              if (!finalDataForSave.numeroBon) missing.push("'N° de bon'");
              
              if (missing.length > 0) {
                alert("L'analyse est terminée mais des champs obligatoires sont manquants : " + missing.join(", ") + ". Veuillez les compléter pour enregistrer.");
              } else {
                // Sauvegarde automatique directe
                handleSave(finalDataForSave);
              }
            }
          }, 800);

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
      const files = Array.from(e.target.files) as File[];
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

  const handleOpenSaisie = (data: any = null) => {
    setExtractionError(null);
    setIsExtracting(false);
    setIsAiProcessed(false); // Reset de l'état IA pour une nouvelle saisie ou modif manuelle
    setFocusedElement({ id: "", rect: null });
    
    // Ignorer si c'est un objet événement
    if (data && data.nativeEvent) data = null;

    // Si c'est une nouvelle saisie (pas de data), on ouvre tous les blocs
    // Si c'est une modif, on les garde fermés par défaut pour plus de clarté
    const shouldCollapse = data ? true : false;

    setCollapsedSections({
      admin: shouldCollapse,
      demandeur: shouldCollapse,
      localisation: shouldCollapse,
      details: shouldCollapse
    });

    if (data) {
      // S'assurer que les passages existent pour l'affichage
      let finalData = { ...data };
      if (!finalData.passages || finalData.passages.length === 0) {
        finalData.passages = [{
          id: Date.now().toString(),
          dateExecution: finalData.dateExecution || "",
          travauxRealises: finalData.travauxRealises || "",
          tempsPasse: finalData.tempsPasse || "",
          nomIntervenant: finalData.nomIntervenant || "Christophe Meyer",
          nouveauPassageRequis: false,
          raisonNouveauPassage: "",
          autreRaison: ""
        }];
      }
      setFormData(finalData);
      setCurrentId(finalData.id);
    } else {
      setFormData({
        dateSaisie: getTodayFormatted(),
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
        photo_url: "",
        archived: false,
        passages: [{
          id: Date.now().toString(),
          dateExecution: "",
          travauxRealises: "",
          tempsPasse: "",
          nomIntervenant: "Christophe Meyer",
          nouveauPassageRequis: false,
          raisonNouveauPassage: "",
          autreRaison: ""
        }]
      });
      setCurrentId(null);
    }
    setView('saisie');
  };

  const handleFieldFocus = (e: any) => {
    if (isAiProcessed || formData.archived) return;
    // On ne s'intéresse qu'aux inputs, textareas et selects
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    
    const rect = e.target.getBoundingClientRect();
    setFocusedElement({ id: e.target.name || e.target.id, rect });
  };

  const handleFieldBlur = () => {
    setTimeout(() => {
      if (!isHoveringFloatingSave) {
        setFocusedElement({ id: "", rect: null });
      }
    }, 200);
  };

  const FloatingSaveButton = () => {
    if (isAiProcessed || formData.archived || !focusedElement.id || !focusedElement.rect) return null;
    
    return (
      <div 
        className="fixed z-[1000] transition-all duration-300 ease-out pointer-events-auto"
        style={{
          left: focusedElement.rect.left + focusedElement.rect.width / 2,
          top: focusedElement.rect.top - 40,
          transform: 'translateX(-50%)'
        }}
        onMouseEnter={() => setIsHoveringFloatingSave(true)}
        onMouseLeave={() => setIsHoveringFloatingSave(false)}
      >
        <button
          type="button"
          onClick={() => {
            handleSave();
            setFocusedElement({ id: "", rect: null });
          }}
          className="bg-[#daa520] text-black px-4 py-2 rounded-full shadow-2xl border-2 border-black/20 font-black text-[10px] uppercase tracking-wider flex items-center gap-2 hover:bg-[#ffb700] hover:scale-110 active:scale-95 transition-all animate-fade-in-down"
        >
          <ShieldCheck size={14} /> Sauvegarder
        </button>
      </div>
    );
  };

  const renderMenu = () => (
    <div className="w-full max-w-lg bg-[#415A77] shadow-2xl border border-slate-500 rounded-lg overflow-hidden">
      <div className="bg-[#1B263B] p-5 border-b border-white/5">
        <div className="flex items-center gap-4">
          <button 
            onClick={fetchInterventions} 
            className="relative flex-shrink-0 group transition-transform active:scale-95"
            title="Rafraîchir les données"
          >
            <Settings size={36} className="text-[#daa520] opacity-90 group-hover:opacity-100" strokeWidth={1.5} />
            <div className="absolute inset-0 flex items-center justify-center pt-0.5">
              {syncStatus === 'synced' && <Cloud size={16} className="text-[#daa520]" />}
              {syncStatus === 'syncing' && <RefreshCw size={16} className="text-[#daa520] animate-spin" />}
              {syncStatus === 'error' && <CloudOff size={16} className="text-red-500" />}
              {syncStatus === 'offline' && <CloudOff size={16} className="text-slate-500" />}
            </div>
          </button>
          
          <h1 className="text-xl font-black tracking-widest flex items-center gap-2">
            <span className="text-white uppercase">Maintenance</span>
            <span className="text-[#daa520] uppercase">Colmar</span>
          </h1>
        </div>
      </div>
      <div className="p-8">
      <div className="space-y-6 pb-2">
        <button 
          onClick={() => handleOpenSaisie()} 
          className="w-full bg-gradient-to-r from-[#b8860b] via-[#ffd700] to-[#daa520] text-black rounded-[2rem] flex items-center justify-between p-1 shadow-xl hover:brightness-105 transition-all group border border-[#daa520]/30"
        >
          <div className="flex items-center gap-4 px-6 py-4 w-full">
            <div className="bg-black/5 p-2 rounded-lg">
              <ClipboardEdit size={40} strokeWidth={1.2} className="text-black/80" />
            </div>
            <span className="flex-grow text-left text-lg font-black uppercase tracking-tighter leading-tight">
              Saisie des bons d'interventions
            </span>
            <ChevronRight size={32} className="text-white drop-shadow-md" strokeWidth={3} />
          </div>
        </button>
        <button 
          onClick={() => setView('consultation')} 
          className="w-full bg-slate-50 text-black rounded-[2rem] flex items-center justify-between p-1 shadow-xl hover:bg-white transition-all group border border-slate-200"
        >
          <div className="flex items-center gap-4 px-6 py-4 w-full">
            <div className="bg-black/5 p-2 rounded-lg">
              <ClipboardList size={40} strokeWidth={1.2} className="text-black/80" />
            </div>
            <span className="flex-grow text-left text-lg font-black uppercase tracking-tighter leading-tight">
              Consultation des interventions
            </span>
            <ChevronRight size={32} className="text-[#daa520] drop-shadow-sm" strokeWidth={3} />
          </div>
        </button>

        <button 
          onClick={() => {
            setSearchQuery("");
            setSearchStartDate("");
            setSearchEndDate(getTodayFormatted());
            setView('recherche');
          }} 
          className="w-full bg-slate-50 text-black rounded-[2rem] flex items-center justify-between p-1 shadow-xl hover:bg-white transition-all group border border-slate-200"
        >
          <div className="flex items-center gap-4 px-6 py-4 w-full">
            <div className="bg-black/5 p-2 rounded-lg">
              <Database size={40} strokeWidth={1.2} className="text-black/80" />
            </div>
            <span className="flex-grow text-left text-lg font-black uppercase tracking-tighter leading-tight">
              Recherche d'intervention
            </span>
            <ChevronRight size={32} className="text-[#daa520] drop-shadow-sm" strokeWidth={3} />
          </div>
        </button>

        <button 
          onClick={() => setView('stats')} 
          className="w-full bg-slate-50 text-black rounded-[2rem] flex items-center justify-between p-1 shadow-xl hover:bg-white transition-all group border border-slate-200"
        >
          <div className="flex items-center gap-4 px-6 py-4 w-full">
            <div className="bg-black/5 p-2 rounded-lg">
              <BarChart3 size={40} strokeWidth={1.2} className="text-black/80" />
            </div>
            <span className="text-left text-lg font-black uppercase tracking-tighter leading-tight mr-4">
              Statistiques
            </span>
            
            {/* Mini Dashboard Style as per image */}
            <div className="flex-grow flex items-center justify-end gap-6 pr-4 border-l border-slate-200 pl-4 py-1">
              <div className="hidden sm:block">
                <p className="text-[8px] font-bold text-slate-500 uppercase mb-1">Statut de flotte</p>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[8px] font-bold">OK</span></div>
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#daa520]"></div><span className="text-[8px] font-bold">ATTENTION</span></div>
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div><span className="text-[8px] font-bold">CRITICAL</span></div>
                </div>
              </div>
              <div className="hidden md:block">
                <p className="text-[8px] font-bold text-slate-500 uppercase mb-1">Dernières actions</p>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[7px] font-bold">Brief - approves</span>
                  <span className="text-[7px] font-bold">Brief - news</span>
                  <span className="text-[7px] font-bold">Brief - interventions</span>
                </div>
              </div>
            </div>
            
            <ChevronRight size={32} className="text-[#daa520] drop-shadow-sm" strokeWidth={3} />
          </div>
        </button>
      </div>
      <div className="mt-8 pt-4 border-t border-slate-200 flex justify-center">
        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Système Industriel v2.5</p>
      </div>
      </div>
    </div>
  );

  const renderSaisie = () => {
    const isArchived = Boolean(formData.archived);

    return (
    <div className="w-full max-w-4xl bg-[#415A77] shadow-2xl border border-slate-500 rounded-lg relative">
      <div ref={formTopRef} className="absolute -top-20" />
      <header className="sticky top-0 z-50 bg-[#1B263B] text-white p-4 md:p-6 flex flex-col sm:flex-row gap-4 justify-between items-center text-center sm:text-left border-b border-white/5 shadow-md">
        <div className="flex w-full sm:w-auto justify-between sm:justify-start items-center gap-4">
          <button onClick={() => setView('menu')} className="text-slate-400 hover:text-[#daa520] font-bold text-sm transition-colors">← MENU</button>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tighter uppercase leading-tight">
              {isArchived ? "Bon archivé" : (currentId ? "Saisie intervention" : "Saisie des bons")}
            </h1>
            <p className="text-[10px] md:text-xs text-[#daa520]/80 font-black uppercase tracking-widest">Maintenance Control</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-center sm:justify-end">
           {!currentId && (
             <>
               {/* Input specifically for Camera */}
               <input type="file" accept="image/*" capture="environment" onChange={(e) => {
                 if (e.target.files && e.target.files.length > 0) {
                   processImage(e.target.files[0]);
                 }
               }} className="hidden" id="photo-upload-camera" />
               
               <div className="flex gap-2 w-full sm:w-auto">
                 <label htmlFor="photo-upload-camera" className={`flex-1 sm:flex-none cursor-pointer bg-white/10 hover:bg-white/20 active:scale-95 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-white/20 transition-all ${isExtracting ? 'opacity-50 pointer-events-none' : ''}`}>
                   <span className="text-lg">📷</span>
                   {isExtracting ? (extractStep || '...') : 'Photo du bon'}
                 </label>
               </div>
             </>
           )}
        </div>
        {formData.numeroBon && (
          <div className="w-full text-center sm:text-right mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
            <span className="text-[10px] md:text-xs font-black text-[#daa520] uppercase tracking-widest bg-[#daa520]/10 px-3 py-1 rounded-full border border-[#daa520]/20">
              N° de bon : {formData.numeroBon}
            </span>
          </div>
        )}
      </header>
      
      {extractionError && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 m-4" role="alert">
          <p className="font-bold">Erreur d'analyse</p>
          <p className="text-sm">{extractionError}</p>
        </div>
      )}

      <form 
        className="p-4 md:p-6 space-y-3"
        onFocusCapture={handleFieldFocus}
        onBlurCapture={handleFieldBlur}
      >
        <div className="bg-[#1B263B]/30 rounded-xl border border-white/5 overflow-hidden">
          <button 
            type="button"
            onClick={() => setCollapsedSections(prev => ({ ...prev, admin: !prev.admin }))}
            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
          >
            <h3 className="text-xs font-black text-[#daa520] uppercase tracking-wider flex items-center gap-2">
              <FileText size={16} /> Données Administratives
            </h3>
            {collapsedSections.admin ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
          </button>
          
          {!collapsedSections.admin && (
            <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase">Colmar le <span className="text-red-500">*</span></label>
                <input name="dateSaisie" value={formData.dateSaisie} onChange={handleChange} disabled={isArchived} type="date" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#daa520] outline-none bg-white text-slate-900 disabled:opacity-75" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase">N° de bon <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <input name="numeroBon" value={formData.numeroBon} onChange={handleChange} disabled={isArchived} type="text" className="flex-grow border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#daa520] outline-none bg-white text-slate-900 font-bold disabled:opacity-75" />
                  {formData.photo_url && (
                    <button 
                      type="button" 
                      onClick={() => window.open(formData.photo_url, '_blank')}
                      className="bg-[#daa520] hover:bg-[#ffb700] text-black text-[10px] font-black px-3 py-1.5 rounded uppercase flex items-center gap-1 transition-all shadow-sm"
                    >
                      <Camera size={14} /> Bons Photos
                    </button>
                  )}
                </div>
              </div></div>
          )}
        </div>
        <div className="bg-[#1B263B]/30 rounded-xl border border-white/5 overflow-hidden">
          <div className="p-3">
            <h3 className="text-xs font-black text-[#daa520] uppercase tracking-wider flex items-center gap-2 mb-4">
              <User size={16} /> Informations Demandeur
            </h3>
            
            {/* Priority Fields: Always visible */}
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase">
                  Demandeur
                </label>
                <input 
                  name="demandeur" 
                  value={formData.demandeur} 
                  onChange={handleChange} 
                  disabled={isArchived} 
                  type="text" 
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#daa520] outline-none bg-white text-slate-900 font-bold disabled:opacity-75" 
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase">Date de demande <span className="text-red-500">*</span></label>
                  <input 
                    name="dateDemande" 
                    value={formData.dateDemande} 
                    onChange={handleChange} 
                    onFocus={() => {
                      if (!formData.dateDemande && formData.dateSaisie) {
                        setFormData(prev => ({ ...prev, dateDemande: formData.dateSaisie }));
                      }
                    }}
                    type="date" 
                    disabled={isArchived}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#daa520] outline-none bg-white text-slate-900 disabled:opacity-75" 
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
                        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#daa520] outline-none bg-white text-slate-900 disabled:opacity-75" 
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
                            className="bg-[#daa520] hover:bg-[#ffb700] active:scale-95 text-black text-[10px] font-black px-3 py-2 rounded uppercase flex items-center gap-2 transition-colors shadow-sm"
                          >
                            <FileText size={14} /> Voir
                          </a>
                          {!isArchived && (
                            <button
                              type="button"
                              onClick={removeDevis}
                              className="p-1 text-red-500 hover:text-red-700 transition-colors"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      ) : pendingDevisPhotos.length > 0 ? (
                        <button
                          type="button"
                          onClick={generateFinalDevisPDF}
                          disabled={isUploadingDevis || isArchived}
                          className="bg-[#daa520] hover:bg-[#ffb700] active:scale-95 text-black text-[10px] font-black px-2 py-1.5 rounded uppercase flex items-center gap-1 transition-colors shadow-sm"
                        >
                          {isUploadingDevis ? <Loader2 size={12} className="animate-spin" /> : "OK (" + pendingDevisPhotos.length + ")"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => devisInputRef.current?.click()}
                          disabled={isUploadingDevis || isArchived}
                          className="bg-[#daa520] hover:bg-[#ffb700] active:scale-95 text-black text-[10px] font-black px-2 py-1.5 rounded uppercase flex items-center gap-1 transition-colors shadow-sm"
                        >
                          <Camera size={14} /> Photo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Trigger for General Info */}
            <button 
              type="button"
              onClick={() => setCollapsedSections(prev => ({ ...prev, demandeur: !prev.demandeur }))}
              className="text-[10px] font-black text-[#daa520]/70 hover:text-[#daa520] uppercase flex items-center gap-1 transition-colors"
            >
              {collapsedSections.demandeur ? 'Voir plus d\'infos demandeur ↓' : 'Voir moins d\'infos demandeur ↑'}
            </button>
          </div>

          {!collapsedSections.demandeur && (
            <div className="p-4 pt-0 space-y-4 border-t border-white/5 pt-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase">Référence Bâtiment</label>
                <input name="refBatiment" value={formData.refBatiment} onChange={handleChange} disabled={isArchived} type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#daa520] outline-none bg-white text-slate-900 disabled:opacity-75" />
              </div>
            </div>
          )}
        </div>
        <div className="bg-[#1B263B]/30 rounded-xl border border-white/5 overflow-hidden">
          <button 
            type="button"
            onClick={() => setCollapsedSections(prev => ({ ...prev, localisation: !prev.localisation }))}
            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
          >
            <h3 className="text-xs font-black text-[#daa520] uppercase tracking-wider flex items-center gap-2">
              <MapPin size={16} /> Localisation
            </h3>
            {collapsedSections.localisation ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
          </button>
          
          {!collapsedSections.localisation && (
            <div className="p-4 pt-0 space-y-4 border-t border-white/5 pt-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase">Lieu</label>
                <input name="lieu" value={formData.lieu} onChange={handleChange} disabled={isArchived} type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#daa520] outline-none bg-white text-slate-900 disabled:opacity-75" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase">Étage</label>
                  <input name="etage" value={formData.etage} onChange={handleChange} disabled={isArchived} type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#daa520] outline-none bg-white text-slate-900 disabled:opacity-75" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase">Pièce</label>
                  <input name="piece" value={formData.piece} onChange={handleChange} disabled={isArchived} type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#daa520] outline-none bg-white text-slate-900 disabled:opacity-75" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#1B263B]/30 rounded-xl border border-white/5 overflow-hidden">
          <button 
            type="button"
            onClick={() => setCollapsedSections(prev => ({ ...prev, details: !prev.details }))}
            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
          >
            <h3 className="text-xs font-black text-[#daa520] uppercase tracking-wider flex items-center gap-2">
              <Settings size={16} /> Détails de l'intervention
            </h3>
            {collapsedSections.details ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronUp size={18} className="text-slate-400" />}
          </button>
          
          {!collapsedSections.details && (
            <div className="p-4 pt-0 space-y-4 border-t border-white/5 pt-4">
              <div className="mb-4">
                <label className="block text-[10px] font-bold text-slate-300 uppercase">Demande</label>
                <input name="demande" value={formData.demande} onChange={handleChange} disabled={isArchived} type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#daa520] outline-none bg-white text-slate-900 font-bold disabled:opacity-75" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase">Description de l'intervention</label>
                <textarea name="description" value={formData.description} onChange={handleChange} disabled={isArchived} className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-[#daa520] outline-none bg-white text-slate-900 h-24 resize-none disabled:opacity-75" />
              </div>
            </div>
          )}
        </div>

        {currentId && (
          <section ref={passagesRef} className="border-t border-slate-200 pt-8 mt-8 scroll-mt-32">
            <div className="flex justify-between items-center border-b-2 border-[#daa520] pb-1 mb-3">
              <h3 className="text-xs font-black text-[#daa520] uppercase tracking-wider">Retour de fiche / Passages</h3>
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
                      <label className="block text-[10px] font-bold text-slate-300 uppercase">
                        Date d'intervention {(passage.tempsPasse || passage.travauxRealises || passage.raisonNouveauPassage) && <span className="text-red-500">*</span>}
                      </label>
                      <input 
                        type="date" 
                        value={passage.dateExecution} 
                        disabled={isArchived}
                        min={formData.dateSaisie} 
                        onChange={(e) => handlePassageChange(passage.id, 'dateExecution', e.target.value)} 
                        onFocus={() => { if (!passage.dateExecution && formData.dateSaisie) handlePassageChange(passage.id, 'dateExecution', formData.dateSaisie) }} 
                        className={`w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#daa520] outline-none bg-white disabled:opacity-75 ${(passage.tempsPasse || passage.travauxRealises || passage.raisonNouveauPassage) && !passage.dateExecution ? 'border-red-500 bg-red-50' : 'border-slate-300'}`} 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-300 uppercase">
                        Temps passé {(passage.dateExecution || passage.travauxRealises || passage.raisonNouveauPassage) && <span className="text-red-500">*</span>}
                      </label>
                      <input 
                        list="temps-passe-list" 
                        value={passage.tempsPasse} 
                        disabled={isArchived}
                        onChange={(e) => handlePassageChange(passage.id, 'tempsPasse', e.target.value)} 
                        type="text" 
                        placeholder="ex: 02h30" 
                        className={`w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#daa520] outline-none bg-white font-bold disabled:opacity-75 ${(passage.dateExecution || passage.travauxRealises || passage.raisonNouveauPassage) && !passage.tempsPasse ? 'border-red-500 bg-red-50' : 'border-slate-300'}`} 
                      />
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-[10px] font-bold text-slate-300 uppercase">Nom de l'intervenant</label>
                    <select 
                      value={passage.nomIntervenant} 
                      disabled={isArchived}
                      onChange={(e) => handlePassageChange(passage.id, 'nomIntervenant', e.target.value)} 
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#daa520] outline-none bg-white font-bold disabled:opacity-75"
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
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-[#daa520] outline-none bg-white h-24 resize-none disabled:opacity-75" 
                    />
                  </div>
                  
                  <div className="pt-4 border-t border-slate-200 space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">
                        État / Suite de l'intervention {(passage.dateExecution || passage.tempsPasse || passage.travauxRealises) && <span className="text-red-500">*</span>}
                      </label>
                      <select 
                        value={passage.raisonNouveauPassage || ""} 
                        onChange={(e) => handlePassageChange(passage.id, 'raisonNouveauPassage', e.target.value)} 
                        className={`w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#daa520] outline-none bg-white font-bold ${(passage.dateExecution || passage.tempsPasse || passage.travauxRealises) && !passage.raisonNouveauPassage ? 'border-red-500 bg-red-50' : 'border-slate-300'}`}
                      >
                        <option value="">Sélectionner l'état</option>
                        {[
                          "Autre passage nécessaire",
                          "Demande de devis",
                          "Intervention d'une autre entreprise nécessaire",
                          "Pièce(s) manquante(s)",
                          "Terminé"
                        ].sort((a, b) => a.localeCompare(b, 'fr')).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
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

      </form>

      {/* Bouton Retour en haut */}
      <button 
        type="button"
        onClick={() => formTopRef.current?.scrollIntoView({ behavior: 'smooth' })}
        className="fixed bottom-6 right-6 w-12 h-12 bg-[#daa520] text-black rounded-full shadow-2xl flex items-center justify-center hover:bg-[#ffb700] transition-all active:scale-95 z-50 border-2 border-[#daa520]/30"
        title="Retour en haut"
      >
        <ChevronUp size={24} />
      </button>

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


  const renderConsultation = () => {
    if (!Array.isArray(interventions)) return <div className="text-white p-8">Erreur : Les données ne sont pas au bon format.</div>;
    
    const displayedInterventions = (interventions || []).filter((i: any) => 
      i && (consultationTab === 'enCours' ? !i.archived : i.archived)
    );
    
    return (
      <div className="w-full max-w-4xl bg-[#415A77] shadow-2xl border border-slate-500 rounded-lg relative">
        <header className="sticky top-0 z-50 bg-[#1B263B] text-white p-4 md:p-6 border-b border-white/5 shadow-md">
          <div className="flex justify-between items-center">
            <div>
              <button onClick={() => setView('menu')} className="text-slate-400 hover:text-[#daa520] font-bold text-sm mb-1 transition-colors block">← MENU</button>
              <h1 className="text-2xl font-black uppercase tracking-tighter">Consultation des <span className="text-[#daa520]">bons</span></h1>
            </div>
            <div className="text-right">
               <p className="text-[10px] text-[#daa520] font-black uppercase tracking-widest">Base de données</p>
            </div>
          </div>
        </header>
        <div className="p-8">
        <p className="text-[10px] text-white/60 font-bold mb-2 italic uppercase tracking-wider">
          Les interventions archivées ne sont plus modifiables
        </p>
        <div className="flex gap-2 mb-6 border-b border-slate-200 pb-4">
          <button 
            onClick={() => setConsultationTab('enCours')}
            className={`px-4 py-2 rounded font-black text-xs uppercase tracking-widest transition-colors ${consultationTab === 'enCours' ? 'bg-[#daa520] text-black shadow-lg shadow-[#daa520]/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
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
          {(displayedInterventions || []).map((i: any) => {
            if (!i) return null;
            return (
            <div key={i.id} className={`w-full p-4 rounded border ${i.archived ? 'bg-slate-100 border-slate-300' : 'bg-white text-slate-900 border-slate-200'}`}>
              <div className='flex justify-between items-center mb-2'>
                <button 
                  onClick={() => handleOpenSaisie(i)} 
                  className={`flex-grow font-bold text-left transition-colors ${i.archived ? 'text-slate-700 hover:text-slate-900' : 'text-slate-900 hover:text-[#daa520]'}`}
                >
                  <div className={`text-base ${isDateOlderThan30Days(i.dateDemande) ? 'text-red-600' : ''}`}>
                    {i.numeroBon ? `Bon n°${i.numeroBon} - ` : ''}{i.lieu} - {i.demande || 'Sans titre'}
                    {isDateOlderThan30Days(i.dateDemande) && (
                      <span className="inline-block bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded ml-2 uppercase tracking-wider align-middle">
                        En retard (+{getDaysElapsed(i.dateDemande)}j)
                      </span>
                    )}
                  </div>
                  {i.passages && i.passages.length > 1 ? (
                    <div className="text-xs text-slate-500 font-normal mt-1">
                      {i.passages.length} passages enregistrés — Total : {(() => {
                        const totalMin = i.passages.reduce((acc: number, p: any) => acc + parseDuration(p.tempsPasse), 0);
                        return formatDuration(totalMin);
                      })()}
                    </div>
                  ) : (i.nomIntervenant && (
                    <div className="text-xs text-slate-500 font-normal mt-1">Intervenant : {i.nomIntervenant} {i.tempsPasse && `(${i.tempsPasse})`}</div>
                  ))}
                  {i.archived && (
                    <div className="text-[10px] font-bold text-emerald-600 mt-2 uppercase">✓ Intervention clôturée</div>
                  )}
                </button>
                <div className='flex gap-2'>
                  <button onClick={() => deleteIntervention(i.id)} className="text-red-600 hover:text-red-800 p-2" aria-label="Supprimer">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
            );
          })}
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
    if (!Array.isArray(interventions)) return <div className="text-white p-8">Erreur : Base de données inaccessible.</div>;

    const uniqueBons = Array.from(new Set(interventions.map((i: any) => i.numeroBon).filter(Boolean)));
    const isSearching = Boolean(searchQuery || searchStartDate || searchEndDate);

    const filteredInterventions = (interventions || []).filter((i: any) => {
      if (!i) return false;
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
        <header className="sticky top-0 z-50 bg-[#1B263B] text-white p-4 md:p-6 border-b border-white/5 shadow-md">
          <div className="flex justify-between items-center">
            <div>
              <button onClick={() => setView('menu')} className="text-slate-400 hover:text-[#daa520] font-bold text-sm mb-1 transition-colors block">← MENU</button>
              <h1 className="text-2xl font-black uppercase tracking-tighter">Recherche de <span className="text-[#daa520]">bons</span></h1>
            </div>
            <div className="text-right">
               <p className="text-[10px] text-[#daa520] font-black uppercase tracking-widest">Base de données</p>
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
              className="w-full border border-slate-300 rounded px-4 py-2 text-base focus:ring-2 focus:ring-[#daa520] outline-none bg-white font-bold"
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
              className="w-full border border-slate-300 rounded px-4 py-2 text-base focus:ring-2 focus:ring-[#daa520] outline-none bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-300 uppercase mb-2">Date saisie (Jusqu'au)</label>
            <input 
              type="date" 
              value={searchEndDate} 
              onChange={(e) => setSearchEndDate(e.target.value)} 
              className="w-full border border-slate-300 rounded px-4 py-2 text-base focus:ring-2 focus:ring-[#daa520] outline-none bg-white"
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
          {isSearching && (filteredInterventions || []).map((i: any) => {
            if (!i) return null;
            return (
            <div key={i.id} className={`w-full p-4 rounded border ${i.archived ? 'bg-slate-100 border-slate-300' : 'bg-white text-slate-900 border-slate-200'}`}>
              <div className='flex justify-between items-center mb-2'>
                <button 
                  onClick={() => handleOpenSaisie(i)} 
                  className={`flex-grow font-bold text-left transition-colors ${i.archived ? 'text-slate-700 hover:text-slate-900' : 'text-slate-900 hover:text-[#daa520]'}`}
                >
                  <div className={`text-base ${isDateOlderThan30Days(i.dateDemande) ? 'text-red-600' : ''}`}>
                    {i.numeroBon ? `Bon n°${i.numeroBon} - ` : ''}{i.lieu} - {i.demande || 'Sans titre'}
                    {isDateOlderThan30Days(i.dateDemande) && (
                      <span className="inline-block bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded ml-2 uppercase tracking-wider align-middle">
                        En retard (+{getDaysElapsed(i.dateDemande)}j)
                      </span>
                    )}
                  </div>
                  {i.passages && i.passages.length > 1 ? (
                    <div className="text-xs text-slate-500 font-normal mt-1">
                      {i.passages.length} passages enregistrés — Total : {(() => {
                        const totalMin = i.passages.reduce((acc: number, p: any) => acc + parseDuration(p.tempsPasse), 0);
                        return formatDuration(totalMin);
                      })()}
                    </div>
                  ) : (i.nomIntervenant && (
                    <div className="text-xs text-slate-500 font-normal mt-1">Intervenant : {i.nomIntervenant} {i.tempsPasse && `(${i.tempsPasse})`}</div>
                  ))}
                  {i.archived && (
                    <div className="text-[10px] font-bold text-emerald-600 mt-2 uppercase">✓ Intervention clôturée</div>
                  )}
                </button>
                <div className='flex gap-2'>
                  <button onClick={() => deleteIntervention(i.id)} className="text-red-600 hover:text-red-800 p-2" aria-label="Supprimer">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
        </div>
      </div>
    );
  };

  const renderStats = () => {
    if (!Array.isArray(interventions)) return <div className="text-white p-8">Erreur : Données de statistiques indisponibles.</div>;

    const filtered = (interventions || []).filter((i: any) => {
      if (!i || !i.archived) return false;
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
        <header className="sticky top-0 z-50 bg-[#1B263B] text-white p-4 md:p-6 border-b border-white/5 shadow-md">
          <div className="flex justify-between items-center">
            <div>
              <button onClick={() => setView('menu')} className="text-slate-400 hover:text-[#daa520] font-bold text-sm mb-1 transition-colors block">← MENU</button>
              <h1 className="text-2xl font-black uppercase tracking-tighter">Tableau de <span className="text-[#daa520]">bord</span></h1>
            </div>
            <div className="text-right">
               <p className="text-[10px] text-[#daa520] font-black uppercase tracking-widest">Reporting Analytique</p>
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
                    className={`px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all ${statsFilter === f.id ? 'bg-[#daa520] text-black shadow-lg shadow-[#daa520]/20' : 'bg-white/10 text-white hover:bg-white/20'}`}
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

        <div className="mb-6 bg-[#daa520] p-4 rounded-lg shadow-lg border-l-8 border-[#b8860b] text-center">
          {(() => {
            const grandTotalMinutes = filtered.reduce((acc: number, i: any) => {
              const itemMinutes = (i.passages || []).reduce((pAcc: number, p: any) => pAcc + parseDuration(p.tempsPasse || ""), 0);
              return acc + itemMinutes;
            }, 0);
            const totalDuration = formatDuration(grandTotalMinutes);
            
            return (
              <h2 className="text-xl font-black text-black uppercase tracking-tighter">
                {statsFilter === 'year' && `TOTAL ${statsYear} : ${filtered.length} (${totalDuration})`}
                {statsFilter === 'month' && `TOTAL ${new Date(2000, parseInt(statsMonth)-1).toLocaleString('fr-FR', { month: 'long' })} ${statsYear} : ${filtered.length} (${totalDuration})`}
                {statsFilter === 'range' && (() => {
                  if (!statsStart || !statsEnd) return `TOTAL DU ? AU ? : ${filtered.length} (${totalDuration})`;
                  const d1 = new Date(statsStart);
                  const d2 = new Date(statsEnd);
                  const monthNames = ["JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE"];
                  
                  if (d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth()) {
                    return `TOTAL DU ${String(d1.getDate()).padStart(2, '0')} AU ${String(d2.getDate()).padStart(2, '0')} ${monthNames[d1.getMonth()]} ${d1.getFullYear()} : ${filtered.length} (${totalDuration})`;
                  }
                  return `TOTAL DU ${statsStart.split('-').reverse().join('/')} AU ${statsEnd.split('-').reverse().join('/')} : ${filtered.length} (${totalDuration})`;
                })()}
              </h2>
            );
          })()}
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
                  if (!i) return null;
                  const totalMinutes = (i.passages || []).reduce((acc: number, p: any) => acc + parseDuration(p.tempsPasse), 0);
                  const delay = getDaysElapsed(i.dateDemande);
                  const isLate = isDateOlderThan30Days(i.dateDemande);

                  return (
                    <tr key={i.id} className={`hover:bg-slate-50 transition-colors ${isLate ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-4">
                        <button 
                          onClick={() => handleOpenSaisie(i)}
                          className="text-[#daa520] hover:text-amber-700 font-black underline decoration-2 underline-offset-4"
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

  // --- Rendu de l'écran de verrouillage ---
  if (isInitializingSecurity) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#daa520] animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4 font-sans text-white">
        <div className="w-full max-w-md bg-[#1e293b] rounded-2xl shadow-2xl border border-slate-700 p-8 flex flex-col items-center">
          <div className="w-20 h-20 bg-[#daa520]/10 rounded-full flex items-center justify-center mb-6 border border-[#daa520]/30 shadow-[0_0_15px_rgba(218,165,32,0.2)]">
            <Lock className="w-10 h-10 text-[#daa520]" />
          </div>
          
          <h1 className="text-2xl font-bold mb-2 tracking-tight">Accès Sécurisé</h1>
          <p className="text-slate-400 mb-8 text-center text-sm">Veuillez entrer votre code de protection pour accéder à l'application de gestion des interventions.</p>
          
          <div className="flex gap-3 mb-8">
            {[...Array(6)].map((_, i) => (
              <div 
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                  pinInput.length > i 
                    ? 'bg-[#daa520] border-[#daa520] scale-110 shadow-[0_0_8px_rgba(218,165,32,0.5)]' 
                    : 'border-slate-600 bg-transparent'
                } ${pinError ? 'bg-red-500 border-red-500 animate-shake' : ''}`}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                onClick={() => handleKeypadPress(num.toString())}
                className="h-16 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-xl font-semibold transition-colors border border-slate-700 flex items-center justify-center"
              >
                {num}
              </button>
            ))}
            <button 
              onClick={() => setPinInput("")}
              className="h-16 rounded-xl bg-slate-800/50 hover:bg-red-900/30 text-red-400 text-sm font-medium transition-colors border border-slate-700/50 flex items-center justify-center"
            >
              Effacer
            </button>
            <button
              onClick={() => handleKeypadPress("0")}
              className="h-16 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-xl font-semibold transition-colors border border-slate-700 flex items-center justify-center"
            >
              0
            </button>
            <button
              onClick={() => handlePinSubmit()}
              className="h-16 rounded-xl bg-[#daa520] hover:bg-[#b8860b] active:scale-95 text-slate-900 flex items-center justify-center transition-all shadow-lg"
            >
              <KeyRound className="w-6 h-6" />
            </button>
          </div>

          <div className="mt-8 flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-[#daa520]/60" />
            <span>Système d'authentification matériel local</span>
          </div>
        </div>
        
        <p className="mt-8 text-slate-600 text-xs">Gestion des Interventions - Maintenance Industrielle</p>
        
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
          }
          .animate-shake {
            animation: shake 0.2s ease-in-out 0s 2;
          }
        `}} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#415A77] p-6 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto">
        {view === 'menu' && renderMenu()}
        {view === 'saisie' && renderSaisie()}
        {view === 'consultation' && renderConsultation()}
        {view === 'recherche' && renderRecherche()}
        {view === 'stats' && renderStats()}
      </div>

      {/* Notification Furtive (Toast) */}
      {notification && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] animate-fade-in-up">
          <div className={`px-6 py-3 rounded-full shadow-2xl border flex items-center gap-3 backdrop-blur-md ${
            notification.type === 'success' 
              ? 'bg-emerald-500/90 border-emerald-400 text-white' 
              : notification.type === 'error'
              ? 'bg-red-500/90 border-red-400 text-white'
              : 'bg-slate-800/90 border-slate-700 text-white'
          }`}>
            {notification.type === 'success' && <ShieldCheck className="w-5 h-5" />}
            <span className="font-bold tracking-wide">{notification.message}</span>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeInUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.3s ease-out forwards;
        }
        .animate-fade-in-down {
          animation: fadeInDown 0.2s ease-out forwards;
        }
      `}} />
      <FloatingSaveButton />
    </div>
  );
}
