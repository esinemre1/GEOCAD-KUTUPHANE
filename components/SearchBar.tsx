
import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, MapPin } from 'lucide-react';
import { SearchResult, Language } from '../types';

interface SearchBarProps {
  onSelect: (result: SearchResult) => void;
  lang: Language;
  t: any;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSelect, lang, t }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (val.length < 3) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=5&accept-language=${lang}`
      );
      const data = await response.json();
      setResults(data);
      setShowDropdown(true);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (res: SearchResult) => {
    onSelect(res);
    setQuery(res.display_name);
    setShowDropdown(false);
  };

  return (
    <div className="relative w-64 md:w-96" ref={dropdownRef}>
      <div className="bg-gray-950/80 backdrop-blur-md border border-gray-800 rounded-xl flex items-center px-3 py-2 shadow-2xl transition-all focus-within:border-blue-500/50">
        <Search size={16} className="text-gray-500 mr-2" />
        <input 
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="bg-transparent border-none outline-none text-xs text-white w-full placeholder:text-gray-600"
          onFocus={() => query.length >= 3 && setShowDropdown(true)}
        />
        {isLoading ? (
          <Loader2 size={16} className="text-blue-500 animate-spin" />
        ) : query && (
          <button onClick={() => { setQuery(''); setResults([]); setShowDropdown(false); }} className="text-gray-500 hover:text-white">
            <X size={16} />
          </button>
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-950/95 backdrop-blur-xl border border-gray-800 rounded-xl overflow-hidden shadow-2xl z-[1100] animate-in fade-in slide-in-from-top-2 duration-200">
          {results.map((res, i) => (
            <button
              key={i}
              onClick={() => handleSelect(res)}
              className="w-full text-left px-4 py-3 text-xs border-b border-gray-800/50 hover:bg-blue-600/10 flex items-start gap-3 transition-colors group"
            >
              <MapPin size={14} className="text-gray-600 mt-0.5 group-hover:text-blue-400 shrink-0" />
              <span className="text-gray-400 group-hover:text-gray-200 leading-tight truncate">{res.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
