import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { LogIn, LayoutDashboard, Users, UserCog, Calendar, Activity, LogOut, Menu, X, Filter, BrainCircuit, FileText, CalendarPlus, Clock, Trash2, Plus, User, Edit, BarChart2, PieChart as PieChartIcon, TrendingUp, Award, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Alumno, Entrenador, EvaluacionFisica, Reserva, Pago, Clase } from './types';
import { supabase } from './services/supabaseClient';
import {
  fetchAlumnos, updateAlumno, deleteAlumno,
  fetchEntrenadores, updateEntrenador, deleteEntrenador, createEntrenador,
  fetchClases, createClase, updateClase, deleteClase,
  fetchReservas, fetchPagos, fetchEvaluaciones,
} from './services/dataService';
import { analyzeStudentProgress } from './services/geminiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

// --- Types for Filtering ---
type PeriodType = 'week' | 'month' | 'semester' | 'year';

// --- Login Component ---
interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Por favor ingrese correo y contraseña.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError('Credenciales inválidas. Intente de nuevo.');
    } else {
      onLogin();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-stone-200">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-pilates-200 rounded-full animate-ping opacity-25"></div>
              <div className="w-20 h-20 bg-gradient-to-tr from-pilates-500 to-pilates-700 rounded-full flex items-center justify-center shadow-lg shadow-pilates-200 relative z-10">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12s2-4 4-4 4 4 4 4" />
                  <path d="M8 12s2 4 4 4 4-4 4-4" />
                </svg>
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-stone-800">MyC Admin Portal</h1>
          <p className="text-stone-500 mt-2">Inicie sesión para continuar</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-pilates-500 focus:border-pilates-500 outline-none transition-colors"
              placeholder="admin@ejemplo.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-pilates-500 focus:border-pilates-500 outline-none transition-colors"
              placeholder="••••••"
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pilates-600 hover:bg-pilates-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Helper Functions for Dates ---
const getWeekNumber = (d: Date) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};

// --- Dashboard Views ---

// 1. Overview Dashboard
const DashboardOverview: React.FC = () => {
  // Remote data
  const [allReservas, setAllReservas] = useState<Reserva[]>([]);
  const [allPagos, setAllPagos] = useState<Pago[]>([]);
  const [alumnosCount, setAlumnosCount] = useState(0);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    Promise.all([fetchReservas(), fetchPagos(), fetchAlumnos()])
      .then(([r, p, a]) => {
        setAllReservas(r);
        setAllPagos(p);
        setAlumnosCount(a.length);
      })
      .catch(console.error)
      .finally(() => setLoadingData(false));
  }, []);

  // Filter State
  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date()); // Defaults to today
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>(1);

  // --- Filtering Logic ---
  const filteredData = useMemo(() => {
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);

    if (periodType === 'week') {
      // Set to Monday of current week
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); 
      start.setDate(diff);
      start.setHours(0,0,0,0);
      
      end.setDate(start.getDate() + 6);
      end.setHours(23,59,59,999);
    } 
    else if (periodType === 'month') {
      start.setDate(1);
      start.setHours(0,0,0,0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23,59,59,999);
    } 
    else if (periodType === 'semester') {
      const year = selectedDate.getFullYear();
      if (selectedSemester === 1) {
        start.setFullYear(year, 0, 1); // Jan 1
        end.setFullYear(year, 5, 30); // Jun 30
      } else {
        start.setFullYear(year, 6, 1); // Jul 1
        end.setFullYear(year, 11, 31); // Dec 31
      }
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
    }
    else if (periodType === 'year') {
      start.setMonth(0, 1);
      start.setHours(0,0,0,0);
      end.setMonth(11, 31);
      end.setHours(23,59,59,999);
    }

    const filteredReservas = allReservas.filter(r => {
      const d = new Date(r.fecha_reserva);
      return d >= start && d <= end;
    });

    const filteredPagos = allPagos.filter(p => {
      const d = new Date(p.created_at);
      return d >= start && d <= end;
    });

    return { reservas: filteredReservas, pagos: filteredPagos, startDate: start, endDate: end };
  }, [periodType, selectedDate, selectedSemester, allReservas, allPagos]);

  // --- Chart Data Preparation ---
  const chartData = useMemo(() => {
    const data: any[] = [];
    const { reservas, startDate } = filteredData;
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    if (periodType === 'week') {
      // Initialize Mon-Sun
      for(let i=1; i<=7; i++) {
        let d = new Date(startDate);
        d.setDate(d.getDate() + (i-1));
        data.push({ 
          name: dayNames[d.getDay()], 
          fullDate: d.getDate(),
          asistencias: 0 
        });
      }
      reservas.forEach(r => {
        const rDate = new Date(r.fecha_reserva);
        // Map 0 (Sun) -> 6, 1 (Mon) -> 0
        let dayIndex = rDate.getDay() === 0 ? 6 : rDate.getDay() - 1;
        if (data[dayIndex]) data[dayIndex].asistencias++;
      });
    }
    else if (periodType === 'month') {
      // Group by Day of Month
      const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        data.push({ name: `${i}`, asistencias: 0 });
      }
      reservas.forEach(r => {
        const d = new Date(r.fecha_reserva).getDate();
        if (data[d-1]) data[d-1].asistencias++;
      });
    }
    else {
      // Semester or Year: Group by Month
      const startMonth = periodType === 'semester' ? (selectedSemester === 1 ? 0 : 6) : 0;
      const endMonth = periodType === 'semester' ? (selectedSemester === 1 ? 5 : 11) : 11;
      
      for(let i = startMonth; i <= endMonth; i++) {
        data.push({ name: monthNames[i], asistencias: 0, monthIndex: i });
      }
      
      reservas.forEach(r => {
        const rMonth = new Date(r.fecha_reserva).getMonth();
        const found = data.find(d => d.monthIndex === rMonth);
        if (found) found.asistencias++;
      });
    }
    return data;
  }, [filteredData, periodType, selectedDate, selectedSemester]);


  const totalAlumnos = alumnosCount;
  const totalClases = filteredData.reservas.length;
  const asistenciaRate = totalClases > 0 
    ? (filteredData.reservas.filter(r => r.asistio).length / totalClases) * 100 
    : 0;
  const totalIngresos = filteredData.pagos.reduce((acc, curr) => acc + curr.monto_pesos, 0);

  // --- Handlers ---
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    
    if (periodType === 'week') {
        setSelectedDate(new Date(val));
    } else if (periodType === 'month') {
        // value is "2023-10"
        const [y, m] = val.split('-');
        setSelectedDate(new Date(parseInt(y), parseInt(m) - 1, 1));
    }
  };
  
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const year = parseInt(e.target.value);
      const newDate = new Date(selectedDate);
      newDate.setFullYear(year);
      setSelectedDate(newDate);
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-stone-100">
        <div className="flex items-center gap-2 text-stone-700">
            <Filter size={20} className="text-pilates-500" />
            <span className="font-semibold">Filtros de Panel</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
            {/* Period Type Selector */}
            <select 
                value={periodType} 
                onChange={(e) => setPeriodType(e.target.value as PeriodType)}
                className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pilates-500 outline-none"
            >
                <option value="week">Semanal</option>
                <option value="month">Mensual</option>
                <option value="semester">Semestral</option>
                <option value="year">Anual</option>
            </select>

            {/* Dynamic Date Selectors */}
            {periodType === 'week' && (
                <input
                    type="date"
                    className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pilates-500 outline-none"
                    onChange={handleDateChange}
                />
            )}

            {periodType === 'month' && (
                <input 
                    type="month"
                    defaultValue={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`}
                    className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pilates-500 outline-none"
                    onChange={handleDateChange}
                />
            )}

            {(periodType === 'semester' || periodType === 'year') && (
                <select 
                    value={selectedDate.getFullYear()}
                    onChange={handleYearChange}
                    className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pilates-500 outline-none"
                >
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                </select>
            )}

            {periodType === 'semester' && (
                <select 
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(parseInt(e.target.value) as 1 | 2)}
                    className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pilates-500 outline-none"
                >
                    <option value="1">Semestre 1 (Ene-Jun)</option>
                    <option value="2">Semestre 2 (Jul-Dic)</option>
                </select>
            )}
        </div>
      </div>

      <h2 className="text-2xl font-bold text-stone-800">Resumen {periodType === 'year' ? 'Anual' : periodType === 'semester' ? 'Semestral' : periodType === 'month' ? 'Mensual' : 'Semanal'}</h2>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Alumnos */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-100 hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-stone-500">Alumnos Totales</p>
              <h3 className="text-2xl font-bold text-stone-800 mt-1">{totalAlumnos}</h3>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
               {/* Custom User Icon */}
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="9" cy="7" r="4" className="fill-blue-200 stroke-blue-600" strokeWidth="1.5"/>
                  <path d="M2 21V17C2 14.7909 3.79086 13 6 13H12C14.2091 13 16 14.7909 16 17V21" className="stroke-blue-600" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M16 3.13001C17.72 3.55001 19 5.09001 19 7.00001C19 9.00001 17.5 10.5 16 11" className="stroke-blue-400" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M19 21V17C19 15.6 18.25 14.4 17 13.7" className="stroke-blue-400" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Card 2: Asistencia */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-100 hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-stone-500">Tasa Asistencia</p>
              <h3 className="text-2xl font-bold text-stone-800 mt-1">{asistenciaRate.toFixed(0)}%</h3>
              <p className="text-xs text-stone-400 mt-1">En periodo seleccionado</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
               {/* Custom Chart/Check Icon */}
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22 11.08V12A10 10 0 1 1 11.85 2.18" className="stroke-green-600" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M22 4L12 14.01L9 11.01" className="stroke-green-600" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="6" className="fill-green-100 opacity-50" />
               </svg>
            </div>
          </div>
        </div>

        {/* Card 3: Clases */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-100 hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-stone-500">Clases/Reservas</p>
              <h3 className="text-2xl font-bold text-stone-800 mt-1">{totalClases}</h3>
              <p className="text-xs text-stone-400 mt-1">En periodo seleccionado</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              {/* Custom Calendar Icon */}
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="4" width="18" height="18" rx="2" className="stroke-purple-600 fill-purple-50" strokeWidth="1.5"/>
                  <path d="M3 10H21" className="stroke-purple-600" strokeWidth="1.5"/>
                  <path d="M16 2V6" className="stroke-purple-600" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M8 2V6" className="stroke-purple-600" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M8 14H16" className="stroke-purple-600" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M8 18H12" className="stroke-purple-600" strokeWidth="1.5" strokeLinecap="round"/>
               </svg>
            </div>
          </div>
        </div>

        {/* Card 4: Ingresos */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-100 hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-stone-500">Ingresos</p>
              <h3 className="text-2xl font-bold text-stone-800 mt-1">${totalIngresos.toLocaleString()}</h3>
              <p className="text-xs text-stone-400 mt-1">En periodo seleccionado</p>
            </div>
            <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
               {/* Custom Finance Icon */}
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 20H22" className="stroke-orange-600" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M5 16L10 11L14 15L21 6" className="stroke-orange-600" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 6H16" className="stroke-orange-600" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M21 6V11" className="stroke-orange-600" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="12" cy="12" r="9" className="fill-orange-100 opacity-20"/>
               </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-100 h-96">
        <h3 className="text-lg font-semibold text-stone-800 mb-4">
            Evolución de Asistencia ({periodType === 'week' ? 'Días' : periodType === 'month' ? 'Días del Mes' : 'Meses'})
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} tickMargin={10} />
            <YAxis axisLine={false} tickLine={false} fontSize={12} />
            <Tooltip 
              cursor={{fill: '#f2fcf9'}}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="asistencias" fill="#42a699" radius={[4, 4, 0, 0]} barSize={periodType === 'month' ? 8 : 40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// 2. Students View
// --- Shared Modals (Edit / Delete) ---
interface EditPersonModalProps {
  title: string;
  nombre: string;
  email: string;
  telefono: string;
  campoExtra?: { label: string; value: string };
  onSave: (nombre: string, email: string, telefono: string, extra: string) => void;
  onClose: () => void;
}

const EditPersonModal: React.FC<EditPersonModalProps> = ({ title, nombre: initNombre, email: initEmail, telefono: initTelefono, campoExtra, onSave, onClose }) => {
  const [nombre, setNombre] = useState(initNombre);
  const [email, setEmail] = useState(initEmail);
  const [telefono, setTelefono] = useState(initTelefono);
  const [extra, setExtra] = useState(campoExtra?.value ?? '');

  const inputCls = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pilates-400";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-bold text-stone-800">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg">
            <X size={18} className="text-stone-400" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Nombre completo</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Correo electrónico</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Teléfono</label>
            <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: +57 300 000 0000" className={inputCls} />
          </div>
          {campoExtra && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{campoExtra.label}</label>
              <input value={extra} onChange={e => setExtra(e.target.value)} className={inputCls} />
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border border-stone-200 rounded-lg text-stone-600 text-sm hover:bg-stone-50 transition-colors">
            Cancelar
          </button>
          <button onClick={() => onSave(nombre, email, telefono, extra)} className="flex-1 py-2 bg-pilates-600 text-white rounded-lg text-sm font-medium hover:bg-pilates-700 transition-colors">
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
};

interface DeleteConfirmModalProps {
  nombre: string;
  onConfirm: () => void;
  onClose: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ nombre, onConfirm, onClose }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
      <div className="text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-stone-800 mb-2">¿Eliminar registro?</h3>
        <p className="text-stone-500 text-sm mb-6">
          Esta acción eliminará a <span className="font-semibold text-stone-700">{nombre}</span> del sistema. No se puede deshacer.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border border-stone-200 rounded-lg text-stone-600 text-sm hover:bg-stone-50 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors">
            Eliminar
          </button>
        </div>
      </div>
    </div>
  </div>
);

// --- Students Management View ---
const StudentsView: React.FC = () => {
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionFisica[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'progreso' | 'info'>('progreso');
  const [selectedStudent, setSelectedStudent] = useState<Alumno | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [editTarget, setEditTarget] = useState<Alumno | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Alumno | null>(null);

  useEffect(() => {
    Promise.all([fetchAlumnos(), fetchEvaluaciones(), fetchReservas()])
      .then(([a, e, r]) => { setAlumnos(a); setEvaluaciones(e); setReservas(r); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleAnalyze = async (student: Alumno) => {
    setAnalyzing(true);
    setAiAnalysis('');
    const evals = evaluaciones.filter(e => e.id_alumno === student.id).sort((a,b) => new Date(a.fecha_evaluacion).getTime() - new Date(b.fecha_evaluacion).getTime());
    const res = reservas.filter(r => r.id_alumno === student.id);
    const result = await analyzeStudentProgress(student, evals, res);
    setAiAnalysis(result);
    setAnalyzing(false);
  };

  const studentEvals = selectedStudent
    ? evaluaciones.filter(e => e.id_alumno === selectedStudent.id).sort((a,b) => new Date(a.fecha_evaluacion).getTime() - new Date(b.fecha_evaluacion).getTime())
    : [];

  const handleDeleteAlumno = async () => {
    if (!deleteTarget) return;
    await deleteAlumno(deleteTarget.id).catch(console.error);
    setAlumnos(prev => prev.filter(a => a.id !== deleteTarget.id));
    if (selectedStudent?.id === deleteTarget.id) setSelectedStudent(null);
    setDeleteTarget(null);
  };

  const handleEditAlumno = async (nombre: string, email: string, telefono: string, patologia_principal: string) => {
    if (!editTarget) return;
    await updateAlumno(editTarget.id, { nombre, email, telefono, patologia_principal }).catch(console.error);
    setAlumnos(prev => prev.map(a => a.id === editTarget.id ? { ...a, nombre, email, telefono, patologia_principal } : a));
    if (selectedStudent?.id === editTarget.id) setSelectedStudent(prev => prev ? { ...prev, nombre, email, telefono, patologia_principal } : null);
    setEditTarget(null);
  };

  const tabCls = (t: 'progreso' | 'info') =>
    `px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t ? 'border-pilates-600 text-pilates-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`;

  if (loading) return <div className="flex items-center justify-center h-64 text-stone-400">Cargando alumnos...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-stone-800">Gestión de Alumnos</h2>

      {/* Tabs */}
      <div className="flex border-b border-stone-200">
        <button className={tabCls('progreso')} onClick={() => setActiveTab('progreso')}>Progreso y Evaluaciones</button>
        <button className={tabCls('info')} onClick={() => setActiveTab('info')}>Información Personal</button>
      </div>

      {activeTab === 'progreso' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden">
            <div className="p-4 border-b border-stone-100 bg-stone-50">
              <h3 className="font-semibold text-stone-700">Lista de Alumnos</h3>
            </div>
            <div className="divide-y divide-stone-100 max-h-[600px] overflow-y-auto">
              {alumnos.map(student => (
                <div
                  key={student.id}
                  onClick={() => { setSelectedStudent(student); setAiAnalysis(''); }}
                  className={`p-4 cursor-pointer hover:bg-pilates-50 transition-colors ${selectedStudent?.id === student.id ? 'bg-pilates-50 border-l-4 border-pilates-500' : ''}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-stone-800">{student.nombre}</p>
                      <p className="text-xs text-stone-500">{student.email}</p>
                    </div>
                    <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      {student.clases_disponibles} Clases
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detail */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-stone-100 p-6">
            {selectedStudent ? (
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-stone-800">{selectedStudent.nombre}</h3>
                    <p className="text-stone-500 text-sm">Registrado: {new Date(selectedStudent.fecha_registro).toLocaleDateString()}</p>
                    <div className="mt-2 inline-block px-3 py-1 bg-red-50 text-red-600 rounded-md text-sm font-medium">
                      Patología: {selectedStudent.patologia_principal}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAnalyze(selectedStudent)}
                    disabled={analyzing}
                    className="flex items-center gap-2 bg-gradient-to-r from-pilates-600 to-pilates-800 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 shadow-md border border-pilates-700"
                  >
                    <BrainCircuit size={18} />
                    {analyzing ? 'Procesando...' : 'Generar Reporte IA'}
                  </button>
                </div>

                {aiAnalysis && (
                  <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-lg border border-indigo-100 animate-fadeIn shadow-sm">
                    <h4 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">
                      <FileText size={18} className="text-indigo-600" />
                      Análisis de Rendimiento
                    </h4>
                    <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-wrap">{aiAnalysis}</p>
                  </div>
                )}

                {studentEvals.length > 0 ? (
                  <div className="space-y-6">
                    <div className="h-64">
                      <h4 className="font-semibold text-stone-700 mb-4">Progreso de Composición Corporal</h4>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={studentEvals}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="fecha_evaluacion" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="porcentaje_grasa" stroke="#ef4444" name="% Grasa" strokeWidth={2} />
                          <Line type="monotone" dataKey="porcentaje_muscular" stroke="#3b82f6" name="% Músculo" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {studentEvals.slice(-1).map(latest => (
                        <React.Fragment key={latest.id}>
                          <div className="bg-stone-50 p-4 rounded-lg">
                            <p className="text-sm text-stone-500">Último Peso</p>
                            <p className="text-xl font-bold text-stone-800">{latest.peso_kg} kg</p>
                          </div>
                          <div className="bg-stone-50 p-4 rounded-lg">
                            <p className="text-sm text-stone-500">Último IMC</p>
                            <p className="text-xl font-bold text-stone-800">{latest.imc}</p>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-stone-400">
                    No hay evaluaciones físicas registradas para este alumno.
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-stone-400">
                Selecciona un alumno para ver detalles y estadísticas
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Información Personal Tab */
        <div className="bg-white rounded-xl shadow-sm border border-stone-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100 text-left">
                <th className="px-4 py-3 font-semibold text-stone-600">Nombre</th>
                <th className="px-4 py-3 font-semibold text-stone-600">Correo</th>
                <th className="px-4 py-3 font-semibold text-stone-600">Teléfono</th>
                <th className="px-4 py-3 font-semibold text-stone-600">Patología</th>
                <th className="px-4 py-3 font-semibold text-stone-600 text-center">Clases</th>
                <th className="px-4 py-3 font-semibold text-stone-600">Registro</th>
                <th className="px-4 py-3 font-semibold text-stone-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {alumnos.map(alumno => (
                <tr key={alumno.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-stone-800">{alumno.nombre}</td>
                  <td className="px-4 py-3 text-stone-600">{alumno.email}</td>
                  <td className="px-4 py-3 text-stone-500">{alumno.telefono ?? <span className="text-stone-300">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs font-medium">{alumno.patologia_principal}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-semibold">{alumno.clases_disponibles}</span>
                  </td>
                  <td className="px-4 py-3 text-stone-500">{new Date(alumno.fecha_registro).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditTarget(alumno)}
                        className="p-1.5 text-stone-400 hover:text-pilates-600 hover:bg-pilates-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(alumno)}
                        className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editTarget && (
        <EditPersonModal
          title="Editar alumno"
          nombre={editTarget.nombre}
          email={editTarget.email}
          telefono={editTarget.telefono ?? ''}
          campoExtra={{ label: 'Patología principal', value: editTarget.patologia_principal }}
          onSave={handleEditAlumno}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          nombre={deleteTarget.nombre}
          onConfirm={handleDeleteAlumno}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

// 3. Classes Management View
const ClassesView: React.FC = () => {
    const [clases, setClases] = useState<Clase[]>([]);
    const [entrenadores, setEntrenadores] = useState<Entrenador[]>([]);
    const [reservas, setReservas] = useState<Reserva[]>([]);
    const [alumnos, setAlumnos] = useState<Alumno[]>([]);
    const [loadingClases, setLoadingClases] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'schedule' | 'analytics'>('schedule');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [analyticsFilter, setAnalyticsFilter] = useState('Todas');

    // Schedule filters
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [filterEntrenador, setFilterEntrenador] = useState('');
    const [filterEstado, setFilterEstado] = useState('');

    useEffect(() => {
      Promise.all([fetchClases(), fetchEntrenadores(), fetchReservas(), fetchAlumnos()])
        .then(([c, e, r, a]) => { setClases(c); setEntrenadores(e); setReservas(r); setAlumnos(a); })
        .catch(console.error)
        .finally(() => setLoadingClases(false));
    }, []);
    
    // Form State
    const [newClass, setNewClass] = useState({
        titulo: '',
        id_entrenador: '',
        fecha_hora: '',
        cupo_maximo: 8
    });

    const formatForInput = (isoString: string) => {
        const d = new Date(isoString);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    };

    const handleEditClass = (clase: Clase) => {
        setNewClass({
            titulo: clase.titulo,
            id_entrenador: clase.id_entrenador,
            fecha_hora: formatForInput(clase.fecha_hora),
            cupo_maximo: clase.cupo_maximo
        });
        setEditingId(clase.id);
        setIsModalOpen(true);
    };

    const handleSaveClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!newClass.titulo || !newClass.id_entrenador || !newClass.fecha_hora) return;

        const payload = {
            titulo: newClass.titulo,
            id_entrenador: newClass.id_entrenador,
            fecha_hora: new Date(newClass.fecha_hora).toISOString(),
            cupo_maximo: newClass.cupo_maximo,
        };

        if (editingId) {
            await updateClase(editingId, payload).catch(console.error);
            setClases(prev => prev.map(c => c.id === editingId ? { ...c, ...payload } : c));
        } else {
            const created = await createClase(payload).catch(console.error);
            if (created) setClases(prev => [...prev, created]);
        }

        setIsModalOpen(false);
        setEditingId(null);
        setNewClass({ titulo: '', id_entrenador: '', fecha_hora: '', cupo_maximo: 8 });
    };

    const handleDeleteClass = async (id: number) => {
        if(window.confirm('¿Estás seguro de que deseas cancelar esta clase?')) {
            await deleteClase(id).catch(console.error);
            setClases(prev => prev.filter(c => c.id !== id));
        }
    };

    // --- Status logic ---
    const getClaseStatus = (clase: Clase, reservasCount: number): 'Activa' | 'Llena' | 'Inactiva' => {
        if (new Date(clase.fecha_hora) < new Date()) return 'Inactiva';
        if (reservasCount >= clase.cupo_maximo) return 'Llena';
        return 'Activa';
    };

    const filteredClases = useMemo(() => {
        return clases.filter(clase => {
            const fechaClase = new Date(clase.fecha_hora);
            if (filterDateFrom) {
                if (fechaClase < new Date(filterDateFrom + 'T00:00:00')) return false;
            }
            if (filterDateTo) {
                if (fechaClase > new Date(filterDateTo + 'T23:59:59')) return false;
            }
            if (filterEntrenador && clase.id_entrenador !== filterEntrenador) return false;
            if (filterEstado) {
                const count = reservas.filter(r => r.id_clase === clase.id).length;
                if (getClaseStatus(clase, count) !== filterEstado) return false;
            }
            return true;
        });
    }, [clases, reservas, filterDateFrom, filterDateTo, filterEntrenador, filterEstado]);

    // --- Analytics Logic ---
    const historicalStats = useMemo(() => {
        const filteredReservas = analyticsFilter === 'Todas'
            ? reservas
            : reservas.filter(r => r.tipo_clase === analyticsFilter);

        const totalHistoricalClasses = new Set(filteredReservas.map(r => r.id_clase)).size;
        const distinctStudents = new Set(filteredReservas.map(r => r.id_alumno)).size;

        // Class type distribution
        const typeDistribution: {[key: string]: number} = {};
        reservas.forEach(r => {
            const type = r.tipo_clase || 'General';
            typeDistribution[type] = (typeDistribution[type] || 0) + 1;
        });
        const pieData = Object.entries(typeDistribution).map(([name, value]) => ({ name, value }));

        // Monthly trends
        const monthlyData: {[key: string]: number} = {};
        filteredReservas.forEach(r => {
            const date = new Date(r.fecha_reserva);
            const key = `${date.toLocaleString('es-ES', { month: 'short' })} ${date.getFullYear()}`;
            monthlyData[key] = (monthlyData[key] || 0) + 1;
        });
        const areaData = Object.entries(monthlyData).map(([name, classes]) => ({ name, classes }));

        // Top instructors (via clases join)
        const instructorCounts: {[key: string]: number} = {};
        filteredReservas.forEach(r => {
            const clase = clases.find(c => c.id === r.id_clase);
            if (clase?.id_entrenador) {
                const trainer = entrenadores.find(e => e.id === clase.id_entrenador);
                const name = trainer?.nombre ?? 'Sin asignar';
                instructorCounts[name] = (instructorCounts[name] || 0) + 1;
            }
        });
        const topInstructors = Object.entries(instructorCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([name, count], i) => ({ rank: i + 1, name, count }));

        // Top students
        const studentCounts: {[key: string]: number} = {};
        filteredReservas.forEach(r => {
            studentCounts[r.id_alumno] = (studentCounts[r.id_alumno] || 0) + 1;
        });
        const topStudents = Object.entries(studentCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([id, count], i) => {
                const s = alumnos.find(a => a.id === id);
                return { rank: i + 1, name: s?.nombre ?? 'Desconocido', count };
            });

        return { totalHistoricalClasses, distinctStudents, pieData, areaData, topInstructors, topStudents };
    }, [analyticsFilter, reservas, clases, entrenadores, alumnos]);
    
    // Colors for Pie Chart
    const COLORS = ['#42a699', '#32877c', '#2a6d65', '#94dbcf'];

    if (loadingClases) return <div className="flex items-center justify-center h-64 text-stone-400">Cargando clases...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-stone-800">Gestión de Clases</h2>
                
                {/* View Switcher */}
                <div className="bg-stone-200 p-1 rounded-lg flex items-center">
                    <button 
                        onClick={() => setViewMode('schedule')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'schedule' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                        Programación
                    </button>
                    <button 
                        onClick={() => setViewMode('analytics')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'analytics' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                        Análisis Histórico
                    </button>
                </div>
            </div>

            {viewMode === 'schedule' ? (
                <>
                    {/* Filter bar */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-100 flex flex-wrap items-end gap-3">
                        <div className="flex items-center gap-2 text-stone-600 self-center mr-1">
                            <Filter size={17} className="text-pilates-500" />
                            <span className="text-sm font-semibold">Filtros</span>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-stone-400">Desde</label>
                            <input
                                type="date"
                                value={filterDateFrom}
                                onChange={e => setFilterDateFrom(e.target.value)}
                                className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-stone-50 focus:ring-2 focus:ring-pilates-400 outline-none"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-stone-400">Hasta</label>
                            <input
                                type="date"
                                value={filterDateTo}
                                onChange={e => setFilterDateTo(e.target.value)}
                                className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-stone-50 focus:ring-2 focus:ring-pilates-400 outline-none"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-stone-400">Entrenador</label>
                            <select
                                value={filterEntrenador}
                                onChange={e => setFilterEntrenador(e.target.value)}
                                className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-stone-50 focus:ring-2 focus:ring-pilates-400 outline-none"
                            >
                                <option value="">Todos</option>
                                {entrenadores.map(e => (
                                    <option key={e.id} value={e.id}>{e.nombre}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-stone-400">Estado</label>
                            <select
                                value={filterEstado}
                                onChange={e => setFilterEstado(e.target.value)}
                                className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-stone-50 focus:ring-2 focus:ring-pilates-400 outline-none"
                            >
                                <option value="">Todos</option>
                                <option value="Activa">Activa</option>
                                <option value="Llena">Llena</option>
                                <option value="Inactiva">Inactiva</option>
                            </select>
                        </div>

                        <div className="flex gap-2 ml-auto">
                            <button
                                onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setFilterEntrenador(''); setFilterEstado(''); }}
                                className="px-3 py-1.5 text-sm text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                            >
                                Limpiar
                            </button>
                            <button
                                onClick={() => { setEditingId(null); setNewClass({ titulo: '', id_entrenador: '', fecha_hora: '', cupo_maximo: 8 }); setIsModalOpen(true); }}
                                className="flex items-center gap-2 bg-pilates-600 text-white px-4 py-1.5 rounded-lg hover:bg-pilates-700 transition-colors shadow-md text-sm"
                            >
                                <Plus size={16} />
                                Nueva Clase
                            </button>
                        </div>
                    </div>

                    {/* Result count */}
                    <p className="text-xs text-stone-400 -mt-2">
                        {filteredClases.length} clase{filteredClases.length !== 1 ? 's' : ''} encontrada{filteredClases.length !== 1 ? 's' : ''}
                    </p>

                    {/* Scrollable grid */}
                    <div className="overflow-y-auto max-h-[600px] pr-1">
                        {filteredClases.length === 0 ? (
                            <div className="flex items-center justify-center h-40 text-stone-400 text-sm">
                                No hay clases que coincidan con los filtros seleccionados.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {filteredClases.map(clase => {
                                    const coach = entrenadores.find(c => c.id === clase.id_entrenador);
                                    const date = new Date(clase.fecha_hora);
                                    const reservasCount = reservas.filter(r => r.id_clase === clase.id).length;
                                    const status = getClaseStatus(clase, reservasCount);
                                    return (
                                        <div key={clase.id} className="bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden hover:shadow-md transition-all group">
                                            <div className="p-5">
                                                <div className="flex justify-between items-start mb-4">
                                                    <h3 className="font-bold text-stone-800 text-lg leading-tight">{clase.titulo}</h3>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleEditClass(clase)}
                                                            className="text-stone-300 hover:text-blue-500 transition-colors"
                                                            title="Editar Clase"
                                                        >
                                                            <Edit size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteClass(clase.id)}
                                                            className="text-stone-300 hover:text-red-500 transition-colors"
                                                            title="Cancelar Clase"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-3 text-stone-600">
                                                        <User size={16} className="text-pilates-500" />
                                                        <span className="text-sm font-medium">{coach?.nombre || 'Instructor no asignado'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-stone-600">
                                                        <CalendarPlus size={16} className="text-pilates-500" />
                                                        <span className="text-sm capitalize">
                                                            {date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-stone-600">
                                                        <Clock size={16} className="text-pilates-500" />
                                                        <span className="text-sm">
                                                            {date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-stone-600">
                                                        <Users size={16} className="text-pilates-500" />
                                                        <span className="text-sm">{reservasCount}/{clase.cupo_maximo} reservas</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-stone-50 px-5 py-3 border-t border-stone-100 flex justify-end">
                                                <span className={`text-xs font-semibold px-2 py-1 rounded-md ${
                                                    status === 'Activa'   ? 'bg-green-50 text-green-700' :
                                                    status === 'Llena'    ? 'bg-amber-50 text-amber-700' :
                                                                            'bg-stone-100 text-stone-400'
                                                }`}>
                                                    {status}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="space-y-6 animate-fadeIn">
                     {/* Analytics Toolbar */}
                     <div className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-stone-100">
                        <Filter size={20} className="text-pilates-500" />
                        <span className="text-sm font-medium text-stone-700">Filtrar Análisis por Tipo:</span>
                        <select 
                            value={analyticsFilter}
                            onChange={(e) => setAnalyticsFilter(e.target.value)}
                            className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-pilates-500 outline-none"
                        >
                            <option value="Todas">Todas las Clases</option>
                            <option value="Reformer">Reformer</option>
                            <option value="Mat">Mat (Suelo)</option>
                        </select>
                     </div>

                     {/* Analytics KPIs */}
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-white to-stone-50 p-6 rounded-xl shadow-sm border border-stone-100">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-stone-500 text-sm font-medium">Clases Realizadas</p>
                                    <h3 className="text-2xl font-bold text-stone-800 mt-1">{historicalStats.totalHistoricalClasses}</h3>
                                </div>
                                <div className="p-2 bg-white rounded-lg shadow-sm border border-stone-100">
                                    <BarChart2 className="text-pilates-600" size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-white to-stone-50 p-6 rounded-xl shadow-sm border border-stone-100">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-stone-500 text-sm font-medium">Alumnos Únicos</p>
                                    <h3 className="text-2xl font-bold text-stone-800 mt-1">{historicalStats.distinctStudents}</h3>
                                </div>
                                <div className="p-2 bg-white rounded-lg shadow-sm border border-stone-100">
                                    <Users className="text-blue-500" size={20} />
                                </div>
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-white to-stone-50 p-6 rounded-xl shadow-sm border border-stone-100">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-stone-500 text-sm font-medium">Ocupación Promedio</p>
                                    <h3 className="text-2xl font-bold text-stone-800 mt-1">85%</h3>
                                </div>
                                <div className="p-2 bg-white rounded-lg shadow-sm border border-stone-100">
                                    <TrendingUp className="text-green-500" size={20} />
                                </div>
                            </div>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                         {/* Chart: Volume over time */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-100 h-80">
                            <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2">
                                <Activity size={18} className="text-pilates-500" />
                                Tendencia de Clases Mensual
                            </h4>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={historicalStats.areaData}>
                                    <defs>
                                        <linearGradient id="colorClasses" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#42a699" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#42a699" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                                    <Area type="monotone" dataKey="classes" stroke="#32877c" fillOpacity={1} fill="url(#colorClasses)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Chart: Distribution */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-100 h-80">
                            <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2">
                                <PieChartIcon size={18} className="text-pilates-500" />
                                Distribución por Tipo
                            </h4>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={historicalStats.pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {historicalStats.pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36}/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                     </div>

                     {/* Leaderboards */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {/* Top Instructors */}
                         <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-100">
                             <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2">
                                 <Award size={18} className="text-yellow-500" />
                                 Top Entrenadores
                             </h4>
                             <div className="space-y-4">
                                 {historicalStats.topInstructors.map((trainer) => (
                                     <div key={trainer.name} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                                         <div className="flex items-center gap-3">
                                             <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                                 trainer.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                                                 trainer.rank === 2 ? 'bg-slate-200 text-slate-600' :
                                                 'bg-orange-100 text-orange-700'
                                             }`}>
                                                 {trainer.rank}
                                             </div>
                                             <span className="font-medium text-stone-700">{trainer.name}</span>
                                         </div>
                                         <div className="text-sm font-semibold text-pilates-600">
                                             {trainer.count} Clases
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         </div>

                         {/* Top Students */}
                         <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-100">
                             <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2">
                                 <Users size={18} className="text-blue-500" />
                                 Alumnos Más Frecuentes
                             </h4>
                             <div className="space-y-4">
                                 {historicalStats.topStudents.map((student) => (
                                     <div key={student.name} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                                         <div className="flex items-center gap-3">
                                             <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">
                                                 {student.rank}
                                             </div>
                                             <span className="font-medium text-stone-700">{student.name}</span>
                                         </div>
                                         <div className="text-sm font-semibold text-stone-500">
                                             {student.count} Asistencias
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         </div>
                     </div>
                </div>
            )}

            {/* Create/Edit Class Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fadeIn">
                        <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                            <h3 className="font-bold text-stone-800">{editingId ? 'Editar Clase' : 'Crear Nueva Clase'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveClass} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Título de la Clase</label>
                                <input 
                                    type="text" 
                                    required
                                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-pilates-500 outline-none"
                                    placeholder="Ej. Pilates Reformer Básico"
                                    value={newClass.titulo}
                                    onChange={e => setNewClass({...newClass, titulo: e.target.value})}
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Entrenador</label>
                                <select 
                                    required
                                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-pilates-500 outline-none bg-white"
                                    value={newClass.id_entrenador}
                                    onChange={e => setNewClass({...newClass, id_entrenador: e.target.value})}
                                >
                                    <option value="">Seleccionar Instructor...</option>
                                    {entrenadores.map(coach => (
                                        <option key={coach.id} value={coach.id}>{coach.nombre} ({coach.especialidad})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Fecha y Hora</label>
                                    <input 
                                        type="datetime-local" 
                                        required
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-pilates-500 outline-none"
                                        value={newClass.fecha_hora}
                                        onChange={e => setNewClass({...newClass, fecha_hora: e.target.value})}
                                    />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Cupo Máximo</label>
                                    <input 
                                        type="number" 
                                        min="1"
                                        required
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-pilates-500 outline-none"
                                        value={newClass.cupo_maximo}
                                        onChange={e => setNewClass({...newClass, cupo_maximo: parseInt(e.target.value)})}
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-stone-200 text-stone-600 rounded-lg hover:bg-stone-50 font-medium"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-pilates-600 text-white rounded-lg hover:bg-pilates-700 font-medium"
                                >
                                    {editingId ? 'Actualizar' : 'Guardar Clase'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// 4. Coaches View
// --- Coach Schedule Modal ---
interface CoachScheduleModalProps {
  coach: Entrenador;
  clases: Clase[];
  onClose: () => void;
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_NAMES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

const CoachScheduleModal: React.FC<CoachScheduleModalProps> = ({ coach, clases, onClose }) => {
  const [viewDate, setViewDate] = useState(() => new Date());

  const coachClases = useMemo(
    () => clases.filter(c => c.id_entrenador === coach.id),
    [clases, coach.id]
  );

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Monday-based offset (0=Mon … 6=Sun)
  let startOffset = firstDayOfMonth.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const getClassesForDay = (day: number) =>
    coachClases
      .filter(c => {
        const d = new Date(c.fecha_hora);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
      })
      .sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime());

  const isDayPast = (day: number) => new Date(year, month, day) < todayStart;
  const isDayToday = (day: number) => new Date(year, month, day).getTime() === todayStart.getTime();

  const pastCount = coachClases.filter(c => new Date(c.fecha_hora) < now).length;
  const futureCount = coachClases.length - pastCount;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-stone-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-pilates-100 rounded-full flex items-center justify-center text-pilates-700 font-bold text-xl">
              {coach.nombre.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-800">{coach.nombre}</h2>
              <p className="text-stone-500 text-sm">{coach.especialidad}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
            <X size={20} className="text-stone-500" />
          </button>
        </div>

        {/* Legend bar */}
        <div className="px-6 py-3 bg-stone-50 border-b border-stone-100 flex items-center gap-6 text-sm flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-stone-200" />
            <span className="text-stone-500">{pastCount} clases realizadas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-pilates-300" />
            <span className="text-stone-500">{futureCount} clases próximas</span>
          </div>
        </div>

        {/* Calendar */}
        <div className="p-6 overflow-y-auto">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} className="text-stone-600" />
            </button>
            <h3 className="text-lg font-bold text-stone-800">
              {MONTH_NAMES[month]} {year}
            </h3>
            <button
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
            >
              <ChevronRight size={20} className="text-stone-600" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-stone-400 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />;

              const dayClasses = getClassesForDay(day);
              const past = isDayPast(day);
              const today = isDayToday(day);

              return (
                <div
                  key={idx}
                  className={`min-h-[72px] p-1 rounded-lg border transition-colors ${
                    today
                      ? 'border-pilates-400 bg-pilates-50'
                      : 'border-transparent hover:border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {/* Day number */}
                  <div
                    className={`text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full mb-0.5 ${
                      today
                        ? 'bg-pilates-600 text-white'
                        : past
                        ? 'text-stone-400'
                        : 'text-stone-700'
                    }`}
                  >
                    {day}
                  </div>

                  {/* Class pills */}
                  <div className="space-y-0.5">
                    {dayClasses.map(cls => (
                      <div
                        key={cls.id}
                        title={`${cls.titulo} — ${fmt(cls.fecha_hora)} · Cupo: ${cls.cupo_maximo}`}
                        className={`text-[9px] leading-tight px-1 py-0.5 rounded font-medium truncate ${
                          past
                            ? 'bg-stone-100 text-stone-400'
                            : 'bg-pilates-100 text-pilates-700'
                        }`}
                      >
                        {fmt(cls.fecha_hora)} {cls.titulo}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Create Entrenador Modal ---
interface CreateEntrenadorModalProps {
  onSave: (data: { nombre: string; email: string; password: string; telefono: string; especialidad: string }) => void;
  onClose: () => void;
  error?: string | null;
}

const CreateEntrenadorModal: React.FC<CreateEntrenadorModalProps> = ({ onSave, onClose, error }) => {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telefono, setTelefono] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const [saving, setSaving] = useState(false);

  const inputCls = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pilates-400";
  const isValid = nombre.trim() && email.trim() && password.trim().length >= 6 && especialidad.trim();

  const handleSubmit = async () => {
    if (!isValid) return;
    setSaving(true);
    await onSave({ nombre: nombre.trim(), email: email.trim(), password: password.trim(), telefono: telefono.trim(), especialidad: especialidad.trim() });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-bold text-stone-800">Nuevo entrenador</h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg">
            <X size={18} className="text-stone-400" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Nombre completo <span className="text-red-400">*</span></label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: María García" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Correo electrónico <span className="text-red-400">*</span></label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Ej: maria@estudio.com" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Contraseña temporal <span className="text-red-400">*</span></label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Teléfono</label>
            <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: +57 300 000 0000" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Especialidad <span className="text-red-400">*</span></label>
            <input value={especialidad} onChange={e => setEspecialidad(e.target.value)} placeholder="Ej: Pilates Reformer, Suelo..." className={inputCls} />
          </div>
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              <span className="mt-0.5">⚠</span>
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border border-stone-200 rounded-lg text-stone-600 text-sm hover:bg-stone-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || saving}
            className="flex-1 py-2 bg-pilates-600 text-white rounded-lg text-sm font-medium hover:bg-pilates-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Creando...' : 'Crear entrenador'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Coaches View ---
const CoachesView: React.FC = () => {
  const [entrenadores, setEntrenadores] = useState<Entrenador[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'directorio' | 'info'>('directorio');
  const [selectedCoach, setSelectedCoach] = useState<Entrenador | null>(null);
  const [editTarget, setEditTarget] = useState<Entrenador | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Entrenador | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchEntrenadores(), fetchClases()])
      .then(([e, c]) => { setEntrenadores(e); setClases(c); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDeleteEntrenador = async () => {
    if (!deleteTarget) return;
    await deleteEntrenador(deleteTarget.id).catch(console.error);
    setEntrenadores(prev => prev.filter(e => e.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleEditEntrenador = async (nombre: string, email: string, telefono: string, especialidad: string) => {
    if (!editTarget) return;
    await updateEntrenador(editTarget.id, { nombre, email, telefono, especialidad }).catch(console.error);
    setEntrenadores(prev => prev.map(e => e.id === editTarget.id ? { ...e, nombre, email, telefono, especialidad } : e));
    setEditTarget(null);
  };

  const handleCreateEntrenador = async (data: { nombre: string; email: string; password: string; telefono: string; especialidad: string }) => {
    setCreateError(null);
    try {
      const nuevo = await createEntrenador(data);
      setEntrenadores(prev => [...prev, nuevo]);
      setShowCreateModal(false);
    } catch (err: any) {
      setCreateError(err?.message ?? 'Error al crear el entrenador. Intente de nuevo.');
    }
  };

  const tabCls = (t: 'directorio' | 'info') =>
    `px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t ? 'border-pilates-600 text-pilates-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`;

  if (loading) return <div className="flex items-center justify-center h-64 text-stone-400">Cargando entrenadores...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-stone-800">Gestión de Entrenadores</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-pilates-600 hover:bg-pilates-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Nuevo entrenador
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200">
        <button className={tabCls('directorio')} onClick={() => setActiveTab('directorio')}>Directorio</button>
        <button className={tabCls('info')} onClick={() => setActiveTab('info')}>Información Personal</button>
      </div>

      {activeTab === 'directorio' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {entrenadores.map(coach => (
            <div key={coach.id} className="bg-white p-6 rounded-xl shadow-sm border border-stone-100 flex flex-col items-center text-center hover:shadow-md transition-shadow">
              <div className="w-20 h-20 bg-pilates-100 rounded-full flex items-center justify-center mb-4 text-pilates-700 font-bold text-xl">
                {coach.nombre.charAt(0)}
              </div>
              <h3 className="text-lg font-bold text-stone-800">{coach.nombre}</h3>
              <p className="text-stone-500 text-sm mb-4">{coach.especialidad}</p>
              <div className="w-full border-t border-stone-100 pt-4 flex justify-between items-center text-sm">
                <span className="text-stone-400">Registro</span>
                <span className="font-medium text-stone-700">{new Date(coach.fecha_registro).toLocaleDateString()}</span>
              </div>
              <button
                onClick={() => setSelectedCoach(coach)}
                className="mt-4 w-full py-2 text-pilates-600 font-medium hover:bg-pilates-50 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Calendar size={15} />
                Ver Horarios
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Información Personal Tab */
        <div className="bg-white rounded-xl shadow-sm border border-stone-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100 text-left">
                <th className="px-4 py-3 font-semibold text-stone-600">Nombre</th>
                <th className="px-4 py-3 font-semibold text-stone-600">Correo</th>
                <th className="px-4 py-3 font-semibold text-stone-600">Teléfono</th>
                <th className="px-4 py-3 font-semibold text-stone-600">Especialidad</th>
                <th className="px-4 py-3 font-semibold text-stone-600">Registro</th>
                <th className="px-4 py-3 font-semibold text-stone-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {entrenadores.map(coach => (
                <tr key={coach.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-stone-800">{coach.nombre}</td>
                  <td className="px-4 py-3 text-stone-600">{coach.email}</td>
                  <td className="px-4 py-3 text-stone-500">{coach.telefono ?? <span className="text-stone-300">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-pilates-50 text-pilates-700 rounded text-xs font-medium">{coach.especialidad}</span>
                  </td>
                  <td className="px-4 py-3 text-stone-500">{new Date(coach.fecha_registro).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditTarget(coach)}
                        className="p-1.5 text-stone-400 hover:text-pilates-600 hover:bg-pilates-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(coach)}
                        className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedCoach && (
        <CoachScheduleModal coach={selectedCoach} clases={clases} onClose={() => setSelectedCoach(null)} />
      )}
      {showCreateModal && (
        <CreateEntrenadorModal
          onSave={handleCreateEntrenador}
          onClose={() => { setShowCreateModal(false); setCreateError(null); }}
          error={createError}
        />
      )}
      {editTarget && (
        <EditPersonModal
          title="Editar entrenador"
          nombre={editTarget.nombre}
          email={editTarget.email}
          telefono={editTarget.telefono ?? ''}
          campoExtra={{ label: 'Especialidad', value: editTarget.especialidad }}
          onSave={handleEditEntrenador}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          nombre={deleteTarget.nombre}
          onConfirm={handleDeleteEntrenador}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

// --- Main Layout ---
const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'students' | 'classes' | 'coaches'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <Loader2 size={32} className="animate-spin text-pilates-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  const renderView = () => {
    switch(currentView) {
      case 'dashboard': return <DashboardOverview />;
      case 'students': return <StudentsView />;
      case 'classes': return <ClassesView />;
      case 'coaches': return <CoachesView />;
      default: return <DashboardOverview />;
    }
  };

  const NavItem = ({ view, icon: Icon, label }: { view: typeof currentView, icon: any, label: string }) => (
    <button
      onClick={() => {
        setCurrentView(view);
        setIsMobileMenuOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
        currentView === view 
          ? 'bg-pilates-600 text-white shadow-lg shadow-pilates-200' 
          : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-stone-50 flex font-sans text-stone-800">
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:sticky top-0 h-screen w-64 bg-white border-r border-stone-200 z-30 transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-pilates-500 rounded-lg flex items-center justify-center">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12s2-4 4-4 4 4 4 4" />
                  <path d="M8 12s2 4 4 4 4-4 4-4" />
               </svg>
             </div>
             <h1 className="text-xl font-bold text-stone-800 tracking-tight">MyC Admin</h1>
           </div>
           <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-stone-500">
             <X size={24} />
           </button>
        </div>

        <nav className="px-4 space-y-2 mt-4">
          <NavItem view="dashboard" icon={LayoutDashboard} label="Panel General" />
          <NavItem view="classes" icon={Calendar} label="Clases" />
          <NavItem view="students" icon={Users} label="Alumnos" />
          <NavItem view="coaches" icon={UserCog} label="Entrenadores" />
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-stone-100">
          <button 
            onClick={() => supabase.auth.signOut()}
            className="w-full flex items-center gap-3 px-4 py-3 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between md:hidden sticky top-0 z-10">
           <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-pilates-500 rounded-lg flex items-center justify-center">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12s2-4 4-4 4 4 4 4" />
                  <path d="M8 12s2 4 4 4 4-4 4-4" />
               </svg>
             </div>
             <h1 className="text-lg font-bold text-stone-800">MyC Admin</h1>
           </div>
           <button onClick={() => setIsMobileMenuOpen(true)} className="text-stone-500">
             <Menu size={24} />
           </button>
        </header>

        <div className="p-6 md:p-10 max-w-7xl mx-auto">
          {renderView()}
        </div>
      </main>
    </div>
  );
};

export default App;