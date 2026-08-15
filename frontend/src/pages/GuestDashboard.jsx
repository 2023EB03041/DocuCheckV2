import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Loader2, Download, CalendarCheck, CalendarClock, ShieldCheck, ChevronDown, ChevronUp,
  Users, BedDouble, AlertCircle, Plus, LogOut
} from 'lucide-react';
import axios from 'axios';
import { guestAuthHeader } from '../utils/guestSession';
import { downloadReservationPdf } from '../utils/reservationPdf';
import { formatINR, nightsBetween } from '../utils/pricing';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const StatusPill = ({ status }) => (
  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{status}</span>
);

const StayCard = ({ reservation, tone }) => {
  const [expanded, setExpanded] = useState(false);
  const nights = reservation.nights || nightsBetween(reservation.checkInDate, reservation.checkOutDate);
  const rooms = (reservation.roomNumbers || []).length;
  const allVerified = reservation.guests?.length > 0 && reservation.guests.every(g => g.status === 'Verified');

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-5">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
          tone === 'upcoming' ? 'bg-[#1a365d]/10 text-[#1a365d]' : 'bg-gray-100 text-gray-500'
        }`}>
          {tone === 'upcoming' ? <CalendarClock className="w-5 h-5" /> : <CalendarCheck className="w-5 h-5" />}
        </div>

        <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">Confirmation</p>
            <p className="font-mono text-sm text-[#1a365d]">{reservation.reservationId}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">Stay</p>
            <p className="text-sm text-gray-800">{formatDate(reservation.checkInDate)} &ndash; {formatDate(reservation.checkOutDate)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">Room</p>
            <p className="text-sm text-gray-800">{reservation.roomType || '-'}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">Total Paid</p>
            <p className="text-sm font-bold text-[#1a365d]">{formatINR(reservation.totalPrice)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => downloadReservationPdf(reservation)}
            className="px-4 py-2.5 bg-[#d4af37] text-white font-bold tracking-wider uppercase text-[11px] hover:bg-[#c5a028] transition-colors flex items-center gap-2 rounded-sm"
          >
            <Download className="w-4 h-4" /> PDF
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2.5 text-gray-400 hover:text-[#1a365d] hover:bg-gray-50 rounded-sm transition-colors"
            aria-label={expanded ? 'Hide details' : 'Show details'}
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-6 grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-top-2 duration-200">
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 pb-2 mb-4">Stay Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">Room Number(s)</p>
                <p className="font-medium text-[#1a365d]">{rooms ? reservation.roomNumbers.join(', ') : 'Assigned at check-in'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Nights</p>
                <p className="font-medium">{nights}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Nightly Rate</p>
                <p className="font-medium">{reservation.pricePerNight ? `${formatINR(reservation.pricePerNight)} / room` : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Rooms Booked</p>
                <p className="font-medium">{rooms || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Contact Phone</p>
                <p className="font-medium">{reservation.phone || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Booked On</p>
                <p className="font-medium">{reservation.createdAt ? formatDate(reservation.createdAt) : '-'}</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 pb-2 mb-4 flex items-center justify-between">
              <span>Guests ({reservation.guests?.length || 0})</span>
              {allVerified && <span className="text-green-600 flex items-center gap-1 normal-case tracking-normal"><ShieldCheck className="w-3.5 h-3.5" /> All IDs cleared</span>}
            </h4>
            <div className="space-y-3">
              {(reservation.guests || []).map((guest, i) => (
                <div key={i} className="bg-white p-3 rounded border border-gray-200 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-[#1a365d] truncate">{guest.name}</p>
                    <p className="text-xs text-gray-500">{guest.idType} &bull; {guest.age ? `${guest.age} yrs` : '-'} &bull; {guest.sex || '-'}</p>
                  </div>
                  <StatusPill status={guest.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const EmptyState = ({ children }) => (
  <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-500 text-sm">
    {children}
  </div>
);

const GuestDashboard = ({ session, onSignOut }) => {
  const navigate = useNavigate();
  const [stays, setStays] = useState({ upcoming: [], past: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('upcoming');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API_URL}/guest/reservations`, { headers: guestAuthHeader() });
        setStays(res.data);
        if (res.data.upcoming.length === 0 && res.data.past.length > 0) setTab('past');
      } catch (err) {
        if (err.response?.status === 401) {
          onSignOut();
          navigate('/login', { replace: true, state: { from: '/account' } });
          return;
        }
        setError(err.response?.data?.message || "We couldn't load your reservations. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate, onSignOut]);

  const visible = tab === 'upcoming' ? stays.upcoming : stays.past;
  const totalStays = stays.upcoming.length + stays.past.length;
  const guestsHosted = [...stays.upcoming, ...stays.past].reduce((sum, r) => sum + (r.guests?.length || 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
        <div>
          <p className="text-[#d4af37] tracking-[0.3em] uppercase text-xs font-bold mb-2">My Account</p>
          <h1 className="text-4xl font-serif text-[#1a365d]">Your Reservations</h1>
          <p className="text-gray-500 text-sm mt-2">Signed in as <span className="font-medium text-gray-700">{session.email}</span></p>
        </div>
        <div className="self-start sm:self-auto flex flex-wrap items-center gap-3">
          <Link
            to="/book"
            className="px-6 py-3 bg-[#1a365d] text-white font-bold tracking-widest uppercase text-xs hover:bg-[#2a4365] transition-colors flex items-center gap-2 rounded-sm"
          >
            <Plus className="w-4 h-4" /> Book a stay
          </Link>
          <button
            onClick={() => { onSignOut(); navigate('/'); }}
            className="px-6 py-3 border border-gray-300 text-gray-600 font-bold tracking-widest uppercase text-xs hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 rounded-sm"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Total Stays</p>
          <p className="text-3xl font-serif text-[#1a365d]">{totalStays}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1 flex items-center gap-1"><BedDouble className="w-3 h-3" /> Upcoming</p>
          <p className="text-3xl font-serif text-[#1a365d]">{stays.upcoming.length}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Guests Hosted</p>
          <p className="text-3xl font-serif text-[#1a365d]">{guestsHosted}</p>
        </div>
      </div>

      <div className="flex bg-gray-100 p-1 rounded-sm mb-6 max-w-sm">
        {[['upcoming', `Upcoming (${stays.upcoming.length})`], ['past', `Past (${stays.past.length})`]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 text-xs font-bold tracking-wider uppercase rounded-sm transition-colors ${
              tab === key ? 'bg-white shadow-sm text-[#1a365d]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-[#d4af37]" /></div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-5 rounded-xl text-sm border border-red-100 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState>
          {tab === 'upcoming'
            ? <>No upcoming stays. <Link to="/book" className="text-[#1a365d] font-bold hover:underline">Book your next one</Link>.</>
            : 'No past stays yet — your completed reservations will be archived here.'}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {visible.map(reservation => (
            <StayCard key={reservation.reservationId} reservation={reservation} tone={tab} />
          ))}
        </div>
      )}
    </div>
  );
};

export default GuestDashboard;
