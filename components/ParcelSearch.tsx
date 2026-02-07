
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Search, Loader2 } from "lucide-react";
import { Language } from "../types";

export interface ParcelSearchProps {
    onParcelFound: (geojson: any) => void;
    lang: Language;
}

const TRANSLATIONS = {
    en: {
        city: "City",
        district: "District",
        neighborhood: "Neighborhood",
        block: "Block / Island",
        parcel: "Parcel",
        search: "Search Parcel",
        select: "Select...",
        loading: "Loading...",
        notFound: "Parcel not found!",
        error: "Service error"
    },
    tr: {
        city: "İl",
        district: "İlçe",
        neighborhood: "Mahalle",
        block: "Ada",
        parcel: "Parsel",
        search: "Parsel Sorgula",
        addToList: "Listeye Ekle",
        bulkShow: "Hepsini Göster",
        clearList: "Listeyi Temizle",
        select: "Seçiniz...",
        loading: "Yükleniyor...",
        notFound: "Parsel bulunamadı!",
        error: "Servis hatası"
    }
};

const ProxyAPI = {
    getIl: () => axios.get("/api/cbs/idariYapi/ilListe"),
    getIlce: (ilId: number) => axios.get(`/api/cbs/idariYapi/ilceListe/${ilId}`),
    getMahalle: (ilceId: number) => axios.get(`/api/cbs/idariYapi/mahalleListe/${ilceId}`),
    getParsel: (mahalleId: number, ada: string, parsel: string) => axios.get(`/api/cbs/parsel/${mahalleId}/${ada}/${parsel}`),
};

const ParcelSearch: React.FC<ParcelSearchProps> = ({ onParcelFound, lang }) => {
    const t = TRANSLATIONS[lang];
    const [cities, setCities] = useState<any[]>([]);
    const [districts, setDistricts] = useState<any[]>([]);
    const [neighborhoods, setNeighborhoods] = useState<any[]>([]);

    const [selectedCity, setSelectedCity] = useState<number | "">("");
    const [selectedDistrict, setSelectedDistrict] = useState<number | "">("");
    const [selectedNeighborhood, setSelectedNeighborhood] = useState<number | "">("");
    const [ada, setAda] = useState("");
    const [parsel, setParsel] = useState("");

    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    // Bulk Search State
    const [bulkList, setBulkList] = useState<{ mahalleId: number, ada: string, parsel: string, text: string }[]>([]);
    const [isBulkLoading, setIsBulkLoading] = useState(false);

    useEffect(() => {
        ProxyAPI.getIl().then(res => setCities(res.data.features || [])).catch(console.error);
    }, []);

    const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = Number(e.target.value);
        setSelectedCity(val); setSelectedDistrict(""); setSelectedNeighborhood("");
        setDistricts([]); setNeighborhoods([]);
        ProxyAPI.getIlce(val).then(res => setDistricts(res.data.features || []));
    };

    const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = Number(e.target.value);
        setSelectedDistrict(val); setSelectedNeighborhood("");
        setNeighborhoods([]);
        ProxyAPI.getMahalle(val).then(res => setNeighborhoods(res.data.features || []));
    };

    const handleSearch = async () => {
        if (!selectedNeighborhood || !ada || !parsel) return;
        setIsLoading(true); setStatus(null);
        try {
            const res = await ProxyAPI.getParsel(Number(selectedNeighborhood), ada, parsel);
            if (res.data && res.data.properties) {
                onParcelFound(res.data.geometry);
                setStatus(null);
            } else {
                setStatus(t.notFound);
            }
        } catch (err) {
            setStatus(t.error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddToList = () => {
        if (!selectedNeighborhood || !ada || !parsel) return;
        // Get names for display
        const nName = neighborhoods.find(n => n.properties.id === selectedNeighborhood)?.properties.text || "";
        const dName = districts.find(d => d.properties.id === selectedDistrict)?.properties.text || "";

        const newItem = {
            mahalleId: Number(selectedNeighborhood),
            ada,
            parsel,
            text: `${dName}/${nName} - Ada: ${ada} Parsel: ${parsel}`
        };
        setBulkList(prev => [...prev, newItem]);
        setAda(""); setParsel("");
    };

    const handleBulkSearch = async () => {
        if (bulkList.length === 0) return;
        setIsBulkLoading(true);
        setStatus(null);

        const features: any[] = [];
        let successCount = 0;

        // Sequential fetching to avoid rate limits
        for (const item of bulkList) {
            try {
                const res = await ProxyAPI.getParsel(item.mahalleId, item.ada, item.parsel);
                if (res.data && res.data.properties && res.data.geometry) {
                    // Add properties to geometry for identification
                    const geom = res.data.geometry;
                    geom.properties = { ...res.data.properties, label: item.text };
                    features.push(geom);
                    successCount++;
                }
            } catch (e) { console.error("Bulk err", e); }
        }

        setIsBulkLoading(false);
        if (features.length > 0) {
            // Create a FeatureCollection
            const fc = { type: "FeatureCollection", features: features.map(f => ({ type: "Feature", geometry: f, properties: f.properties })) };
            onParcelFound(fc); // Send as single layer
            setStatus(`${successCount} adet parsel bulundu.`);
            setBulkList([]); // Clear list after success
        } else {
            setStatus(t.notFound);
        }
    };

    const sortItems = (items: any[]) => items.sort((a, b) => a.properties.text.localeCompare(b.properties.text, 'tr'));

    return (
        <div className="space-y-3 p-1">
            <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">{t.city}</label>
                <select value={selectedCity} onChange={handleCityChange} className="w-full bg-gray-900 border border-gray-800 rounded p-1.5 text-xs text-gray-300 outline-none focus:border-blue-500">
                    <option value="">{t.select}</option>
                    {sortItems(cities).map(c => <option key={c.properties.id} value={c.properties.id}>{c.properties.text}</option>)}
                </select>
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">{t.district}</label>
                <select value={selectedDistrict} onChange={handleDistrictChange} disabled={!selectedCity} className="w-full bg-gray-900 border border-gray-800 rounded p-1.5 text-xs text-gray-300 outline-none focus:border-blue-500 disabled:opacity-50">
                    <option value="">{t.select}</option>
                    {sortItems(districts).map(d => <option key={d.properties.id} value={d.properties.id}>{d.properties.text}</option>)}
                </select>
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">{t.neighborhood}</label>
                <select value={selectedNeighborhood} onChange={(e) => setSelectedNeighborhood(Number(e.target.value))} disabled={!selectedDistrict} className="w-full bg-gray-900 border border-gray-800 rounded p-1.5 text-xs text-gray-300 outline-none focus:border-blue-500 disabled:opacity-50">
                    <option value="">{t.select}</option>
                    {sortItems(neighborhoods).map(n => <option key={n.properties.id} value={n.properties.id}>{n.properties.text}</option>)}
                </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">{t.block}</label>
                    <input type="text" value={ada} onChange={e => setAda(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded p-1.5 text-xs text-white outline-none focus:border-blue-500" placeholder="0" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">{t.parcel}</label>
                    <input type="text" value={parsel} onChange={e => setParsel(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded p-1.5 text-xs text-white outline-none focus:border-blue-500" placeholder="0" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
                <button onClick={handleSearch} disabled={isLoading || isBulkLoading || !selectedNeighborhood || !ada || !parsel} className="py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1">
                    {isLoading ? <Loader2 className="animate-spin" size={12} /> : <Search size={12} />}
                    {t.search}
                </button>
                <button onClick={handleAddToList} disabled={!selectedNeighborhood || !ada || !parsel} className="py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg text-[10px] font-bold uppercase transition-colors">
                    {t.addToList}
                </button>
            </div>

            {/* Bulk List UI */}
            {bulkList.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-800">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-500 uppercase">Sorgu Listesi ({bulkList.length})</span>
                        <button onClick={() => setBulkList([])} className="text-[9px] text-red-500 hover:text-red-400 font-bold uppercase">{t.clearList}</button>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 rounded p-2 max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                        {bulkList.map((item, idx) => (
                            <div key={idx} className="text-[10px] text-gray-400 flex justify-between items-center group">
                                <span className="truncate max-w-[180px]">{item.text}</span>
                                <button onClick={() => setBulkList(prev => prev.filter((_, i) => i !== idx))} className="text-gray-600 hover:text-red-400"><Search size={10} className="rotate-45" /></button>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleBulkSearch} disabled={isBulkLoading} className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 text-white rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2">
                        {isBulkLoading ? <Loader2 className="animate-spin" size={12} /> : t.bulkShow}
                    </button>
                </div>
            )}

            {status && (
                <div className={`text-center p-2 rounded border ${status === t.notFound || status === t.error ? 'border-red-500/30 text-red-400 bg-red-500/10' : 'border-gray-800 text-gray-400'}`}>
                    <span className="text-[10px] font-bold uppercase">{status}</span>
                </div>
            )}
        </div>
    );
};

export default ParcelSearch;
