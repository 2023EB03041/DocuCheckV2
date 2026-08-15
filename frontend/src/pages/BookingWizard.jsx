import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, ChevronRight, CheckCircle2, ShieldCheck, UploadCloud, Loader2, CreditCard, Lock, AlertCircle, Download, Mail } from 'lucide-react';
import axios from 'axios';
import DateField from '../components/DateField';
import { quoteStay, formatINR } from '../utils/pricing';
import { guestAuthHeader } from '../utils/guestSession';
import { downloadReservationPdf } from '../utils/reservationPdf';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
// Parse a 'YYYY-MM-DD' string into a local Date.
const ymdToDate = (s) => { if (!s) return undefined; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

const StepIcon = ({ state }) => {
  if (state === 'active') return <Loader2 className="w-4 h-4 text-[#d4af37] animate-spin shrink-0" />;
  if (state === 'done') return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
  return <span className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />;
};

const VerifyStep = ({ state, children }) => (
  <div className="flex items-center gap-2 text-left">
    <StepIcon state={state} />
    <span className={`text-xs ${state === 'pending' ? 'text-gray-400' : 'text-gray-700'}`}>{children}</span>
  </div>
);

const BookingWizard = ({ session, onSessionExpired }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [errors, setErrors] = useState({});

  
  const guestEmail = session.email;


  const handleExpiredSession = (message) => {
    alert(message);
    onSessionExpired();
    navigate('/login', { state: { from: '/book' } });
  };

  // Booking State
  const [booking, setBooking] = useState({
    checkInDate: '',
    checkOutDate: '',
    guestCount: 2,
   
    guests: [
      { name: '', age: '', sex: '', idType: '' },
      { name: '', age: '', sex: '', idType: '' }
    ],
    roomType: '',
    pricePerNight: 0,
    phone: ''
  });

  // Verification State (Files array matching guest indices)
  const [files, setFiles] = useState([null, null]);

  const [passes, setPasses] = useState([null, null]);
  
  const [rejections, setRejections] = useState({});
  const [extracting, setExtracting] = useState({});

  const [uploadStage, setUploadStage] = useState({});
  
  // Payment State
  const [payment, setPayment] = useState({
    cardName: '',
    cardNumber: '',
    expiry: '',
    cvc: ''
  });
  
  // Payment Simulation State
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle, connecting, otp, processing, success
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  
  // Final Result
  const [reservation, setReservation] = useState(null);

  // Update guests array when guestCount changes
  const handleGuestCountChange = (count) => {
    const num = parseInt(count);
    let newGuests = [...booking.guests];
    let newFiles = [...files];
    let newPasses = [...passes];
    if (num > newGuests.length) {
      for (let i = newGuests.length; i < num; i++) {
        newGuests.push({ name: '', age: '', sex: '', idType: '' });
        newFiles.push(null);
        newPasses.push(null);
      }
    } else {
      newGuests = newGuests.slice(0, num);
      newFiles = newFiles.slice(0, num);
      newPasses = newPasses.slice(0, num);
    }
    setBooking({ ...booking, guestCount: num, guests: newGuests });
    setFiles(newFiles);
    setPasses(newPasses);
  };

  const handleFileChange = async (index, file) => {
    if (file) {
      // Check if duplicate file in the current booking session
      const isDuplicate = files.some((f, i) => i !== index && f && f.name === file.name && f.size === file.size);
      if (isDuplicate) {
        alert("You have already uploaded this exact document for another guest. Please provide a unique ID.");
        return;
      }
    }

    // Safely clear only this guest's file
    const clearFile = () => {
      setFiles(prev => { const c = [...prev]; c[index] = null; return c; });
      setPasses(prev => { const c = [...prev]; c[index] = null; return c; });
      setBooking(prev => {
        const g = [...prev.guests];
        g[index] = { ...g[index], name: '', age: '', sex: '', idType: '' };
        return { ...prev, guests: g };
      });
    };

    setFiles(prev => { const c = [...prev]; c[index] = file; return c; });

    if (!file) return;

    setExtracting(prev => ({ ...prev, [index]: true }));
    setUploadStage(prev => ({ ...prev, [index]: { phase: 'reading' } }));

  
    const toChecking = setTimeout(() => {
      setUploadStage(prev => (
        prev[index]?.phase === 'reading' ? { ...prev, [index]: { phase: 'checking' } } : prev
      ));
    }, 2200);

    const formData = new FormData();
    formData.append('idDocument', file);
    if (booking.checkInDate) formData.append('checkInDate', booking.checkInDate);
    if (booking.checkOutDate) formData.append('checkOutDate', booking.checkOutDate);

    try {
      const res = await axios.post(`${API_URL}/verify`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', ...guestAuthHeader() },
        timeout: 120000 
      });

      const { verified, extractedName, extractedAge, extractedSex, idType, documentPass, outcome, message } = res.data;

      // Only a document the issuing authority confirmed is kept.
      if (!verified) {
        setUploadStage(prev => { const c = { ...prev }; delete c[index]; return c; });
        clearFile();
        setRejections(prev => ({
          ...prev,
          [index]: {
            outcome: outcome || 'replace',
            message: message || 'We could not confirm this ID. Please upload a different one.'
          }
        }));
        return;
      }

      setUploadStage(prev => ({ ...prev, [index]: { phase: 'done', verified: true } }));
      setRejections(prev => { const c = { ...prev }; delete c[index]; return c; });
      setPasses(prev => { const c = [...prev]; c[index] = documentPass; return c; });
      setBooking(prev => {
        const g = [...prev.guests];
        g[index] = {
          ...g[index],
          name: extractedName,
          age: extractedAge,
          sex: extractedSex || '',
          idType: idType || ''
        };
        return { ...prev, guests: g };
      });
    } catch (err) {
      // Any failure must reject the file,
  
      let msg;
      let outcome = 'retry';
      if (err.code === 'ECONNABORTED') {
        msg = "Verification timed out — the server may be waking up. Please try uploading again in a moment.";
      } else if (err.response?.data?.message) {
      
        msg = err.response.data.message;
        outcome = err.response.status === 400 ? 'replace' : 'retry';
      } else {
        msg = "We couldn't verify this document (the server may be busy). Please try uploading it again.";
      }

      clearFile();
      setUploadStage(prev => { const c = { ...prev }; delete c[index]; return c; });

      if (err.response?.status === 401) {
        handleExpiredSession('Your session has expired. Please sign in again to continue your booking.');
      } else {
        setRejections(prev => ({ ...prev, [index]: { outcome, message: msg } }));
      }
    } finally {
      clearTimeout(toChecking);
      setExtracting(prev => ({ ...prev, [index]: false }));
    }
  };


  useEffect(() => {
    if (step === 2) {
      const fetchRooms = async () => {
        setLoading(true);
        try {
          const res = await axios.get(`${API_URL}/reservations/rooms`);
          const available = res.data.filter(r => r.status === 'Available');
          
          const uniqueTypes = [];
          const distinctRooms = [];
          for (const room of available) {
            if (!uniqueTypes.includes(room.type)) {
              uniqueTypes.push(room.type);
              distinctRooms.push(room);
            }
          }
          setAvailableRooms(distinctRooms);
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      };
      fetchRooms();
    }
  }, [step]);

 
  const handleSearchAvailability = () => {
    const newErrors = {};
    if (!booking.checkInDate) newErrors.checkInDate = 'Please choose a check-in date';
    if (!booking.checkOutDate) {
      newErrors.checkOutDate = 'Please choose a check-out date';
    } else if (booking.checkOutDate <= booking.checkInDate) {
      newErrors.checkOutDate = 'Check-out must be after check-in';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) setStep(2);
  };

  const validateStep3 = () => {
    const newErrors = {};
    if (!booking.phone || !/^[6-9]\d{9}$/.test(booking.phone)) {
      newErrors.phone = "Valid 10-digit Indian phone number required";
    }
    
    booking.guests.forEach((guest, index) => {
     
      if (!passes[index] || !files[index]) {
        newErrors[`guest_file_${index}`] = "A confirmed ID document is required for this guest";
        return;
      }
      if (!guest.name || guest.name.trim().length < 2) {
        newErrors[`guest_${index}`] = "Full name could not be extracted";
      }
      if (!guest.age || isNaN(guest.age) || guest.age < 18) {
        newErrors[`guest_age_${index}`] = "Valid age (18+) could not be extracted";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextToPayment = () => {
    if (validateStep3()) {
      setStep(4);
    }
  };

  const handleRoomSelect = (room) => {
  
    setBooking(prev => ({ ...prev, roomType: room.type, pricePerNight: room.pricePerNight }));
    setStep(3);
  };

  const validatePayment = () => {
    const newErrors = {};
    if (!payment.cardName || payment.cardName.trim().length < 2) {
      newErrors.cardName = "Name on card is required";
    }
    if (!payment.cardNumber || !/^\d{16}$/.test(payment.cardNumber.replace(/\s/g, ''))) {
      newErrors.cardNumber = "Valid 16-digit card number required";
    }
    if (!payment.expiry || !/^(0[1-9]|1[0-2])\/([0-9]{2})$/.test(payment.expiry)) {
      newErrors.expiry = "Valid expiry date (MM/YY) required";
    } else {
      const [mm, yy] = payment.expiry.split('/').map(Number);
      const now = new Date();
      const curYY = now.getFullYear() % 100;
      const curMM = now.getMonth() + 1;
      if (yy < curYY || (yy === curYY && mm < curMM)) {
        newErrors.expiry = "Card expiry cannot be in the past";
      }
    }
    if (!payment.cvc || !/^\d{3}$/.test(payment.cvc)) {
      newErrors.cvc = "Valid 3-digit CVC required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCardNumberChange = (e) => {
    let val = e.target.value.replace(/\D/g, '').substring(0, 16);
    let formatted = val.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    setPayment({...payment, cardNumber: formatted});
  };

  const handleExpiryChange = (e) => {
    let val = e.target.value.replace(/\D/g, '').substring(0, 4);
    if (val.length >= 3) {
      val = val.substring(0, 2) + '/' + val.substring(2);
    }
    setPayment({...payment, expiry: val});
  };

  const handleCvcChange = (e) => {
    let val = e.target.value.replace(/\D/g, '').substring(0, 3);
    setPayment({...payment, cvc: val});
  };

  const quote = quoteStay({
    pricePerNight: booking.pricePerNight,
    guestCount: booking.guestCount,
    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate
  });
  const { subtotal, gst, rooms: requiredRooms, nights, total: finalTotal } = quote;

  const handleBook = () => {
    if (!validatePayment()) return;
    setPaymentStatus('connecting');

    setTimeout(() => {
      setGeneratedOtp(String(Math.floor(100000 + Math.random() * 900000)));
      setOtp('');
      setPaymentStatus('otp');
    }, 2000);
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) return;
    if (otp !== generatedOtp) {
      alert('Incorrect OTP. Please enter the OTP shown on screen.');
      return;
    }

    setPaymentStatus('processing');
    try {
    
      const res = await axios.post(`${API_URL}/reservations`, {
        ...booking,
        guests: booking.guests.map((guest, index) => ({ ...guest, documentPass: passes[index] }))
      }, { headers: guestAuthHeader() });

      setReservation(res.data);

      setPaymentStatus('success');
      setTimeout(() => {
        setPaymentStatus('idle');
        setStep(5); 
      }, 1500);
      
    } catch (error) {
      console.error(error);
      setPaymentStatus('idle');
      if (error.response?.status === 401) {
        handleExpiredSession('Your session has expired. Please sign in again to complete the booking.');
        return;
      }

      const message = error.response?.data?.message || 'Payment processing failed. Please try again.';
      alert(message);

    
      if (/ID document|confirmed ID|own ID/i.test(message)) {
        setStep(3);
      }
    }
  };

  const handleDownloadPDF = () => {
    if (reservation) downloadReservationPdf(reservation);
  };

  return (
    <div className="max-w-5xl mx-auto mt-10 p-4 sm:p-6 mb-20">
      
      {/* Progress Bar */}
      {step < 5 && (
        <div className="mb-16 mt-4 max-w-3xl mx-auto">
          <div className="relative h-1 bg-gray-200 rounded-full w-full">
            <div className="absolute left-0 top-0 h-1 bg-[#1a365d] rounded-full transition-all duration-500" style={{ width: `${((step - 1) / 3) * 100}%` }}></div>
            
            {['Search', 'Select Room', 'Guest Details', 'Payment'].map((label, i) => (
              <div key={label} className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 flex flex-col items-center" style={{ left: `${(i / 3) * 100}%` }}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors duration-300 z-10 ${
                  step > i + 1 ? 'bg-[#1a365d] border-[#1a365d] text-white' : 
                  step === i + 1 ? 'bg-white border-[#1a365d] text-[#1a365d]' : 'bg-white border-gray-300 text-gray-400'
                }`}>
                  {step > i + 1 ? <CheckCircle2 className="w-5 h-5 text-white" /> : i + 1}
                </div>
                <span className={`absolute top-10 w-32 text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${step >= i + 1 ? 'text-[#1a365d]' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Dates */}
      {step === 1 && (
        <div className="bg-white p-8 sm:p-12 rounded-xl shadow-lg border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-3xl font-serif text-[#1a365d] mb-8 text-center">When will you be joining us?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Check-in</label>
              <DateField
                icon={Calendar}
                label="Check-in date"
                value={booking.checkInDate}
                minDate={startOfToday()}
                onChange={(v) => setBooking({ ...booking, checkInDate: v, checkOutDate: booking.checkOutDate && booking.checkOutDate <= v ? '' : booking.checkOutDate })}
              />
              {errors.checkInDate && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errors.checkInDate}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Check-out</label>
              <DateField
                icon={Calendar}
                label="Check-out date"
                value={booking.checkOutDate}
                minDate={ymdToDate(booking.checkInDate) || startOfToday()}
                onChange={(v) => setBooking({ ...booking, checkOutDate: v })}
              />
              {errors.checkOutDate && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errors.checkOutDate}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Guests</label>
              <div className="relative">
                <Users className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-sm focus:ring-2 focus:ring-[#d4af37] focus:border-transparent outline-none transition-all appearance-none"
                  value={booking.guestCount} onChange={e => handleGuestCountChange(e.target.value)}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'Guest' : 'Guests'}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <button onClick={handleSearchAvailability} className="w-full bg-[#1a365d] text-white py-4 rounded-sm font-bold tracking-widest uppercase hover:bg-[#2a4365] transition-colors flex items-center justify-center gap-2">
            Check Availability <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Step 2: Room Selection */}
      {step === 2 && (
        <div className="animate-in fade-in slide-in-from-right-8 duration-500">
          <h2 className="text-3xl font-serif text-[#1a365d] mb-8 text-center">Select Your Haven</h2>
          
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-[#d4af37]" /></div>
          ) : availableRooms.length === 0 ? (
            <div className="text-center py-20 text-gray-500">No rooms available for selected dates.</div>
          ) : (
            <div className="space-y-6">
              {availableRooms.map(room => {
                const roomQuote = quoteStay({
                  pricePerNight: room.pricePerNight,
                  guestCount: booking.guestCount,
                  checkInDate: booking.checkInDate,
                  checkOutDate: booking.checkOutDate
                });
                const imgPath = room.type === 'Presidential Suite' ? '/room_presidential.jpg' :
                                room.type === 'Ocean View' ? '/room_ocean.jpg' : 
                                room.type === 'Deluxe' ? '/room_deluxe.jpg' : '/room_standard.jpg';
                return (
                  <div key={room._id} className="bg-white flex flex-col md:flex-row border border-gray-200 rounded-sm overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
                    <div className="w-full md:w-1/3 h-48 md:h-auto relative bg-gray-100">
                      <img src={imgPath} alt={room.type} className="absolute inset-0 w-full h-full object-cover" />
                    </div>
                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="text-2xl font-serif text-[#1a365d]">{room.type}</h3>
                            {roomQuote.rooms > 1 && <span className="inline-block bg-[#1a365d]/10 text-[#1a365d] text-[10px] font-bold px-2 py-0.5 uppercase rounded tracking-wide mt-1">{roomQuote.rooms} Rooms Required for {booking.guestCount} Guests</span>}
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-[#d4af37]">{formatINR(roomQuote.pricePerNight)}</p>
                            <p className="text-xs text-gray-400 uppercase tracking-wide">per room, per night</p>
                            <p className="text-sm font-medium text-gray-700 mt-2">
                              {formatINR(roomQuote.subtotal)} <span className="text-xs font-normal text-gray-500">for {roomQuote.nights} {roomQuote.nights === 1 ? 'night' : 'nights'}{roomQuote.rooms > 1 ? ` × ${roomQuote.rooms} rooms` : ''}</span>
                            </p>
                            <p className="text-[11px] text-gray-400">+ {formatINR(roomQuote.gst)} GST</p>
                          </div>
                        </div>
                        <p className="text-gray-600 mb-4 line-clamp-2">
                          Experience ultimate comfort in our {room.type.toLowerCase()}. Features premium bedding, marble bathroom, and exclusive resort amenities.
                        </p>
                      </div>
                      <button onClick={() => handleRoomSelect(room)} className="w-full md:w-auto self-end px-8 py-3 border-2 border-[#1a365d] text-[#1a365d] font-bold tracking-wider uppercase text-sm hover:bg-[#1a365d] hover:text-white transition-colors">
                        Select Room
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Guest Details & Verification */}
      {step === 3 && (
        <div className="animate-in fade-in slide-in-from-right-8 duration-500">
          <div className="bg-white p-8 sm:p-12 rounded-xl shadow-lg border border-gray-100">
            <h2 className="text-3xl font-serif text-[#1a365d] mb-6">Contact Information</h2>
            
            <div className="mb-10 border-b border-gray-200 pb-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email (Primary Contact)</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="email" readOnly
                      className="w-full pl-11 pr-10 py-3 bg-gray-100 border border-green-500 rounded-sm outline-none text-gray-700 cursor-not-allowed"
                      value={guestEmail} />
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                  </div>
                  <p className="text-green-600 text-xs mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Verified when you signed in — your confirmation goes here
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phone Number</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">+91</span>
                    <input type="tel" className={`w-full pl-12 pr-4 py-3 bg-gray-50 border ${errors.phone ? 'border-red-500' : 'border-gray-200'} rounded-sm outline-none focus:border-[#d4af37]`}
                      value={booking.phone} onChange={e => setBooking({...booking, phone: e.target.value.replace(/\D/g, '').substring(0, 10)})} placeholder="9876543210" />
                  </div>
                  {errors.phone && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errors.phone}</p>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <ShieldCheck className="w-6 h-6 text-[#1a365d]" />
              <h3 className="text-2xl font-bold text-[#1a365d]">Pre-Arrival Verification</h3>
            </div>
            <p className="text-gray-600 mb-8 text-sm">
              Every guest needs an Aadhaar or PAN card. Each one is read and then confirmed against the issuing authority's record, and only a card that is confirmed can be used to book — so if an ID is turned away here, upload a clearer photo of it or a different document.
            </p>

            <div className="space-y-12">
              {Array.from({ length: Math.ceil(booking.guests.length / 2) }).map((_, roomIndex) => (
                <div key={roomIndex} className="mb-10 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-[#1a365d]/5 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <h4 className="text-lg font-serif text-[#1a365d] font-bold">Room {roomIndex + 1}</h4>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{Math.min(2, booking.guests.length - roomIndex * 2)} Guest(s)</span>
                  </div>
                  <div className="p-6 space-y-10">
                    {booking.guests.slice(roomIndex * 2, roomIndex * 2 + 2).map((guest, localIndex) => {
                      const index = roomIndex * 2 + localIndex;
                      return (
                        <div key={index} className="bg-gray-50 p-6 rounded-lg border border-gray-200 relative">
                          <div className="absolute -top-4 -left-4 w-8 h-8 bg-[#1a365d] text-white rounded-full flex items-center justify-center font-bold text-sm shadow-md">
                            {index + 1}
                          </div>
                  
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Guest {index + 1} Full Name</label>
                      <input type="text" readOnly className={`w-full px-4 py-3 bg-gray-100 border ${errors[`guest_${index}`] ? 'border-red-500' : 'border-gray-200'} rounded-sm outline-none text-gray-600 cursor-not-allowed`}
                        value={guest.name} placeholder="Auto-filled from ID" />
                      {errors[`guest_${index}`] && <p className="text-red-500 text-xs mt-1">{errors[`guest_${index}`]}</p>}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Age</label>
                        <input type="number" readOnly className={`w-full px-4 py-3 bg-gray-100 border ${errors[`guest_age_${index}`] ? 'border-red-500' : 'border-gray-200'} rounded-sm outline-none text-gray-600 cursor-not-allowed`}
                          value={guest.age} placeholder="--" />
                        {errors[`guest_age_${index}`] && <p className="text-red-500 text-xs mt-1">{errors[`guest_age_${index}`]}</p>}
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sex</label>
                        <div className="relative">
                          <input type="text" readOnly className={`w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-sm outline-none text-gray-600 cursor-not-allowed`}
                            value={guest.sex || ''} placeholder="--" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">ID Document Type</label>
                      <input type="text" readOnly className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-sm outline-none text-gray-600 cursor-not-allowed"
                        value={guest.idType || ''} placeholder="Detected from your ID" />
                    </div>
                  </div>
                  
                  <div className="relative group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(index, e.target.files[0])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 ${
                      files[index] ? 'border-green-500 bg-green-50/50' : 'border-gray-300 bg-white group-hover:border-[#d4af37]'
                    }`}>
                      {extracting[index] ? (
                        <div className="flex flex-col items-center">
                          <p className="text-sm font-medium text-gray-700 mb-3">Verifying this ID...</p>
                          <div className="w-full max-w-[17rem] space-y-2">
                            <VerifyStep state={uploadStage[index]?.phase === 'reading' ? 'active' : 'done'}>
                              Reading the details on the card
                            </VerifyStep>
                            <VerifyStep state={uploadStage[index]?.phase === 'checking' ? 'active' : 'pending'}>
                              Confirming against government records
                            </VerifyStep>
                          </div>
                          <div className="w-full max-w-[17rem] h-1 bg-gray-200 rounded-full mt-3 overflow-hidden">
                            <div className={`h-full bg-[#d4af37] rounded-full transition-all duration-1000 ease-out ${
                              uploadStage[index]?.phase === 'reading' ? 'w-1/2' : 'w-[90%]'
                            }`} />
                          </div>
                        </div>
                      ) : files[index] ? (
                     
                        <div className="flex flex-col items-center">
                          <p className="font-medium text-gray-900 text-sm mb-3">{files[index].name}</p>
                          <div className="w-full max-w-[17rem] space-y-2">
                            <VerifyStep state="done">Details read and filled in above</VerifyStep>
                            <VerifyStep state="done">Confirmed against government records</VerifyStep>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <UploadCloud className="w-8 h-8 text-gray-400 mb-2 group-hover:text-[#d4af37]" />
                          <p className="text-sm font-medium text-gray-700">Upload an Aadhaar or PAN card to verify this guest</p>
                          <p className="text-xs text-gray-500 mt-1">JPG, PNG up to 5MB</p>
                        </div>
                      )}
                    </div>
                    {rejections[index] && (
                      <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-100 flex items-start gap-2 text-left">
                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs text-red-700 leading-relaxed">{rejections[index].message}</p>
                          <p className="text-[11px] text-red-500 mt-1 font-bold uppercase tracking-wider">
                            {rejections[index].outcome === 'retry'
                              ? 'Upload the same card again'
                              : 'Upload a different document'}
                          </p>
                        </div>
                      </div>
                    )}
                    {errors[`guest_file_${index}`] && <p className="text-red-500 text-xs mt-2 text-center font-bold">{errors[`guest_file_${index}`]}</p>}
                  </div>
                </div>
                );
              })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 flex justify-between">
              <button onClick={() => setStep(2)} className="px-6 py-3 text-gray-500 font-bold tracking-wider uppercase text-sm hover:bg-gray-100 transition-colors">Back</button>
              <button onClick={handleNextToPayment} className="px-8 py-3 bg-[#1a365d] text-white font-bold tracking-wider uppercase text-sm hover:bg-[#2a4365] transition-colors">
                Continue to Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Payment */}
      {step === 4 && (
        <div className="animate-in fade-in slide-in-from-right-8 duration-500 grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 bg-white p-8 sm:p-10 rounded-xl shadow-lg border border-gray-100">
            <h2 className="text-2xl font-serif text-[#1a365d] mb-2 flex items-center gap-2">
              <Lock className="w-5 h-5 text-gray-400" /> Secure Checkout
            </h2>
            <p className="text-gray-500 text-sm mb-6">Note: Space and / are not needed when filling the details.</p>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Name on Card</label>
                <input type="text" className={`w-full px-4 py-3 bg-gray-50 border ${errors.cardName ? 'border-red-500' : 'border-gray-200'} rounded-sm outline-none focus:border-[#d4af37]`} 
                  placeholder="As it appears on card"
                  value={payment.cardName} onChange={e => setPayment({...payment, cardName: e.target.value.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())})} />
                {errors.cardName && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errors.cardName}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Card Number</label>
                <div className="relative">
                  <CreditCard className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input type="text" placeholder="0000 0000 0000 0000" className={`w-full pl-12 pr-4 py-3 bg-gray-50 border ${errors.cardNumber ? 'border-red-500' : 'border-gray-200'} rounded-sm outline-none font-mono focus:border-[#d4af37]`} 
                    value={payment.cardNumber} onChange={handleCardNumberChange} />
                </div>
                {errors.cardNumber && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errors.cardNumber}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Expiry</label>
                  <input type="text" placeholder="MM/YY" className={`w-full px-4 py-3 bg-gray-50 border ${errors.expiry ? 'border-red-500' : 'border-gray-200'} rounded-sm outline-none focus:border-[#d4af37]`} 
                    value={payment.expiry} onChange={handleExpiryChange} />
                  {errors.expiry && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errors.expiry}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">CVC</label>
                  <input type="password" placeholder="123" className={`w-full px-4 py-3 bg-gray-50 border ${errors.cvc ? 'border-red-500' : 'border-gray-200'} rounded-sm outline-none focus:border-[#d4af37]`} 
                    value={payment.cvc} onChange={handleCvcChange} />
                  {errors.cvc && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errors.cvc}</p>}
                </div>
              </div>
            </div>

            <div className="mt-10 flex justify-between items-center">
              <button onClick={() => setStep(3)} className="text-gray-500 font-bold text-sm tracking-wider uppercase hover:underline">Back</button>
              <button onClick={handleBook} disabled={paymentStatus !== 'idle'} className="px-10 py-4 bg-[#d4af37] text-white font-bold tracking-widest uppercase text-sm shadow-xl shadow-[#d4af37]/20 hover:bg-[#c5a028] transition-all flex items-center gap-2 disabled:opacity-70">
                Pay ₹{finalTotal.toLocaleString('en-IN')}
              </button>
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 h-fit">
            <h3 className="font-bold text-gray-900 mb-4 uppercase tracking-wider text-sm border-b pb-4">Booking Summary</h3>
            <div className="space-y-4 mb-6">
              <div>
                <p className="text-xs text-gray-500 uppercase">Room Type</p>
                <p className="font-serif font-medium text-[#1a365d]">{booking.roomType}</p>
              </div>
              <div className="flex justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Rooms</p>
                  <p className="font-medium text-gray-900">{requiredRooms}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Nights</p>
                  <p className="font-medium text-gray-900">{nights}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Guests</p>
                  <p className="font-medium text-gray-900">{booking.guestCount}</p>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{formatINR(booking.pricePerNight)} × {requiredRooms} {requiredRooms === 1 ? 'room' : 'rooms'} × {nights} {nights === 1 ? 'night' : 'nights'}</span>
                <span className="font-medium">{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">GST (18%)</span>
                <span className="font-medium">{formatINR(gst)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-[#1a365d] pt-2 border-t border-gray-200 mt-2">
                <span>Total</span>
                <span>{formatINR(finalTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Simulation Modal */}
      {paymentStatus !== 'idle' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md p-8 rounded-lg shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
            
            {paymentStatus === 'connecting' && (
              <div className="text-center py-10">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Connecting to Secure Gateway</h3>
                <p className="text-gray-500 text-sm">Please wait while we establish a secure connection with your bank...</p>
              </div>
            )}
            
            {paymentStatus === 'otp' && (
              <div className="animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                  <h3 className="text-lg font-bold text-gray-900">Bank Authentication</h3>
                  <span aria-label="Visa" className="text-[#1a1f71] font-extrabold italic text-2xl tracking-tight select-none" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>VISA</span>
                </div>
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-md mb-6">
                  <p className="text-sm text-blue-900 mb-2">Merchant: <strong>Lumina Resort & Spa</strong></p>
                  <p className="text-sm text-blue-900 mb-2">Amount: <strong>₹{finalTotal.toLocaleString('en-IN')}</strong></p>
                  <p className="text-sm text-blue-900 mb-2">Card: <strong>XXXX-XXXX-XXXX-{payment.cardNumber.slice(-4) || '1234'}</strong></p>
                </div>
                <p className="text-gray-700 text-sm mb-3">A One Time Password (OTP) has been sent to your registered mobile number. Please enter it below to authorize this transaction.</p>
                <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-2 text-center">
                  <span className="text-[10px] text-amber-700 uppercase tracking-widest font-bold">Demo OTP</span>
                  <p className="text-2xl font-mono font-bold tracking-[0.4em] text-amber-900">{generatedOtp}</p>
                </div>
                <div className="mb-6">
                  <input type="text" inputMode="numeric" maxLength={6} placeholder="Enter OTP"
                    className="w-full text-center font-mono text-xl tracking-[0.4em] indent-[0.4em] px-4 py-3 border border-gray-300 rounded-md outline-none focus:border-blue-500"
                    value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').substring(0, 6))} />
                </div>
                <button onClick={handleVerifyOTP} disabled={otp.length !== 6} 
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50">
                  Submit & Authenticate
                </button>
              </div>
            )}

            {paymentStatus === 'processing' && (
              <div className="text-center py-10 animate-in fade-in duration-300">
                <Loader2 className="w-12 h-12 animate-spin text-[#d4af37] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Processing Payment</h3>
                <p className="text-gray-500 text-sm">Please do not refresh the page or click back.</p>
              </div>
            )}

            {paymentStatus === 'success' && (
              <div className="text-center py-10 animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Payment Successful</h3>
                <p className="text-gray-500 text-sm">Redirecting to confirmation...</p>
              </div>
            )}
            
          </div>
        </div>
      )}

      {/* Step 5: Confirmation */}
      {step === 5 && reservation && (
        <div className="bg-white p-10 rounded-xl shadow-2xl max-w-2xl mx-auto animate-in zoom-in duration-500 border-t-8 border-[#1a365d]">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-4xl font-serif text-[#1a365d] mb-2">Booking Confirmed</h2>
            <p className="text-gray-500">Thank you! Your reservation is confirmed.</p>
          </div>
          
          <div className="bg-gray-50 p-6 rounded-lg mb-8 text-left border border-gray-200">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Confirmation ID</p>
                <p className="text-2xl font-mono text-gray-900">{reservation.reservationId}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Room</p>
                <p className="text-xl font-serif text-[#1a365d]">{(reservation.roomNumbers && reservation.roomNumbers.length) ? reservation.roomNumbers.join(', ') : 'Assigned at check-in'}</p>
              </div>
            </div>
            
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Guest Verification Status</h3>
            <div className="space-y-4">
              {reservation.guests.map((guest, idx) => (
               
                <div key={idx} className="flex items-start gap-4 p-4 rounded-md border bg-white shadow-sm">
                  <ShieldCheck className="w-6 h-6 mt-1 text-green-500" />
                  <div>
                    <p className="font-bold text-gray-900">{guest.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {guest.idType} confirmed against government records. Cleared for mobile key.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <p className="text-center text-sm text-gray-500 mt-8">
            A copy of this confirmation is kept in your account — sign in with <span className="font-medium text-gray-700">{guestEmail}</span> any time to view it or download the PDF again.
          </p>

          <div className="text-center flex flex-wrap justify-center gap-4 mt-6">
            <button onClick={handleDownloadPDF} className="px-8 py-3 bg-[#d4af37] text-white font-bold tracking-widest uppercase text-sm shadow-md hover:bg-[#c5a028] transition-colors flex items-center gap-2">
              <Download className="w-5 h-5" /> Download PDF
            </button>
            <button onClick={() => navigate('/account')} className="px-8 py-3 border-2 border-[#1a365d] text-[#1a365d] font-bold tracking-widest uppercase text-sm hover:bg-[#1a365d] hover:text-white transition-colors">
              My Reservations
            </button>
            <button onClick={() => navigate('/')} className="px-8 py-3 text-gray-500 font-bold tracking-widest uppercase text-sm hover:text-[#1a365d] transition-colors">
              Return Home
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default BookingWizard;
