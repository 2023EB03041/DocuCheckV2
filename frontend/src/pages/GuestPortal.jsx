import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, ChevronRight, CheckCircle2, ShieldCheck, UploadCloud, FileText, Loader2, CreditCard, Lock, AlertCircle, Download } from 'lucide-react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import DateField from '../components/DateField';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

// Local midnight today, used as the earliest selectable check-in date.
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
// Parse a 'YYYY-MM-DD' string into a local Date.
const ymdToDate = (s) => { if (!s) return undefined; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

const GuestPortal = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [errors, setErrors] = useState({});
  
  // Booking State
  const [booking, setBooking] = useState({
    checkInDate: '',
    checkOutDate: '',
    guestCount: 2,
    guests: [
      { name: '', age: '', sex: 'Male', idType: 'Aadhaar Card' },
      { name: '', age: '', sex: 'Male', idType: 'Aadhaar Card' }
    ],
    roomType: '',
    totalPrice: 0,
    email: '',
    phone: ''
  });

  // Verification State (Files array matching guest indices)
  const [files, setFiles] = useState([null, null]);
  const [extracting, setExtracting] = useState({});
  
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
    if (num > newGuests.length) {
      for (let i = newGuests.length; i < num; i++) {
        newGuests.push({ name: '', age: '', sex: 'Male', idType: 'Aadhaar Card' });
        newFiles.push(null);
      }
    } else {
      newGuests = newGuests.slice(0, num);
      newFiles = newFiles.slice(0, num);
    }
    setBooking({ ...booking, guestCount: num, guests: newGuests });
    setFiles(newFiles);
  };

  const handleGuestChange = (index, field, value) => {
    const updatedGuests = [...booking.guests];
    if (field === 'name') {
      value = value.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    }
    updatedGuests[index] = { ...updatedGuests[index], [field]: value };
    setBooking({ ...booking, guests: updatedGuests });
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

    // Safely clear only this guest's file (never leave an unverified file "accepted").
    const clearFile = () => setFiles(prev => { const c = [...prev]; c[index] = null; return c; });

    setFiles(prev => { const c = [...prev]; c[index] = file; return c; });

    if (!file) return;

    setExtracting(prev => ({ ...prev, [index]: true }));
    const formData = new FormData();
    formData.append('idDocument', file);
    if (booking.checkInDate) formData.append('checkInDate', booking.checkInDate);
    if (booking.checkOutDate) formData.append('checkOutDate', booking.checkOutDate);

    try {
      const res = await axios.post(`${API_URL}/verify/extract`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000 // OCR on the free tier can be slow / cold-start
      });

      const { success, extractedName, extractedAge, extractedSex, error } = res.data;
      if (success && extractedName) {
        setBooking(prev => {
          const g = [...prev.guests];
          g[index] = {
            ...g[index],
            name: extractedName.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()),
            ...(extractedAge ? { age: extractedAge } : {}),
            ...(extractedSex ? { sex: extractedSex } : {}),
          };
          return { ...prev, guests: g };
        });
      } else {
        alert(error || "This document does not appear to be a valid ID, or it is too blurry to read. Please upload a clear photo of a valid Govt ID.");
        clearFile();
      }
    } catch (err) {
      // Any failure (timeout, server busy, duplicate, network) must reject the file,
      // never silently keep it. Show a useful message and let the guest retry.
      let msg;
      if (err.code === 'ECONNABORTED') {
        msg = "Verification timed out — the server may be waking up. Please try uploading again in a moment.";
      } else if (err.response?.data?.message) {
        msg = err.response.data.message;
      } else {
        msg = "We couldn't verify this document (the server may be busy). Please try uploading it again.";
      }
      alert(msg);
      clearFile();
    } finally {
      setExtracting(prev => ({ ...prev, [index]: false }));
    }
  };

  // Fetch available rooms when reaching step 2
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

  const validateStep3 = () => {
    const newErrors = {};
    if (!booking.email || !/^\S+@\S+\.\S+$/.test(booking.email)) {
      newErrors.email = "Valid email is required";
    }
    if (!booking.phone || !/^[6-9]\d{9}$/.test(booking.phone)) {
      newErrors.phone = "Valid 10-digit Indian phone number required";
    }
    
    booking.guests.forEach((guest, index) => {
      if (!files[index]) {
        newErrors[`guest_file_${index}`] = "ID Document upload is mandatory";
      }
      if (!guest.name || guest.name.trim().length < 2) {
        newErrors[`guest_${index}`] = "Full name could not be extracted";
      }
      if (!guest.age || isNaN(guest.age) || guest.age < 18) {
        newErrors[`guest_age_${index}`] = "Valid age (18+) could not be extracted";
      }
      if (!guest.sex) {
        newErrors[`guest_sex_${index}`] = "Sex could not be extracted";
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
    const requiredRooms = Math.ceil(booking.guestCount / 2);
    setBooking(prev => ({ ...prev, roomType: room.type, totalPrice: room.pricePerNight * requiredRooms }));
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

  const subtotal = booking.totalPrice;
  const gst = subtotal * 0.18;
  const finalTotal = subtotal + gst;

  const handleBook = () => {
    if (!validatePayment()) return;
    setPaymentStatus('connecting');

    // Simulate connecting to bank gateway, then issue a demo OTP.
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
      // 1. Create Reservation
      const resData = { 
        ...booking,
        totalPrice: finalTotal,
        checkInDate: booking.checkInDate || new Date(), 
        checkOutDate: booking.checkOutDate || new Date(Date.now() + 86400000) 
      };
      const res = await axios.post(`${API_URL}/reservations`, resData);
      const newReservation = res.data;
      
      // 2. Upload Documents for each guest
      const uploadPromises = files.map((file, index) => {
        if (!file) return Promise.resolve(); // Skip if no file uploaded for this guest
        
        const formData = new FormData();
        formData.append('idDocument', file);
        return axios.post(`${API_URL}/verify/${newReservation.reservationId}/${index}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        }).catch(err => console.error(`Error uploading for guest ${index}:`, err));
      });

      await Promise.all(uploadPromises);
      
      // Fetch updated reservation to get individual guest statuses
      const finalRes = await axios.get(`${API_URL}/reservations/${newReservation.reservationId}`);
      setReservation(finalRes.data);
      
      setPaymentStatus('success');
      setTimeout(() => {
        setPaymentStatus('idle');
        setStep(5); // Success step
      }, 1500);
      
    } catch (error) {
      console.error(error);
      setPaymentStatus('idle');
      alert('Payment processing failed. Please try again.');
    }
  };

  const handleDownloadPDF = () => {
    if (!reservation) return;
    const doc = new jsPDF();
    
    // Header Background
    doc.setFillColor(26, 54, 93);
    doc.rect(0, 0, 210, 40, 'F');
    
    // Header Text
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.text('LUMINA RESORT & SPA', 105, 20, null, null, 'center');
    
    doc.setFontSize(11);
    doc.setTextColor(212, 175, 55); // Gold
    doc.text('LUXURY LIVING AT ITS FINEST', 105, 30, null, null, 'center');
    
    // Title
    doc.setFontSize(16);
    doc.setTextColor(26, 54, 93);
    doc.text('Booking Confirmation', 20, 55);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(20, 58, 190, 58);
    
    // Details
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    
    // Column 1
    doc.setFont(undefined, 'bold');
    doc.text('Confirmation ID:', 20, 70);
    doc.setFont(undefined, 'normal');
    doc.text(reservation.reservationId, 55, 70);

    doc.setFont(undefined, 'bold');
    doc.text('Room Type:', 20, 80);
    doc.setFont(undefined, 'normal');
    doc.text(reservation.roomType, 55, 80);
    
    doc.setFont(undefined, 'bold');
    doc.text('Room Numbers:', 20, 90);
    doc.setFont(undefined, 'normal');
    doc.text((reservation.roomNumbers || []).join(', ') || 'Assigned at check-in', 55, 90);

    // Column 2
    doc.setFont(undefined, 'bold');
    doc.text('Check-In:', 115, 70);
    doc.setFont(undefined, 'normal');
    doc.text(new Date(reservation.checkInDate).toLocaleDateString(), 145, 70);

    doc.setFont(undefined, 'bold');
    doc.text('Check-Out:', 115, 80);
    doc.setFont(undefined, 'normal');
    doc.text(new Date(reservation.checkOutDate).toLocaleDateString(), 145, 80);
    
    doc.setFont(undefined, 'bold');
    doc.text('Total Price:', 115, 90);
    doc.setFont(undefined, 'normal');
    doc.text(`INR ${reservation.totalPrice.toLocaleString('en-IN')}`, 145, 90);

    // Guest Info Section
    doc.setFontSize(14);
    doc.setTextColor(26, 54, 93);
    doc.setFont(undefined, 'normal');
    doc.text('Guest Details & Verification', 20, 110);
    doc.line(20, 113, 190, 113);

    let y = 125;
    reservation.guests.forEach((guest, index) => {
      // Draw light box for each guest
      doc.setFillColor(249, 250, 251);
      doc.rect(20, y - 5, 170, 16, 'F');
      
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.setFont(undefined, 'bold');
      doc.text(`${index + 1}. ${guest.name}`, 25, y);
      
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`ID: ${guest.idType}`, 25, y + 6);
      
      const statusColor = guest.status === 'Verified' ? [34, 197, 94] : (guest.status === 'Failed' ? [239, 68, 68] : [234, 179, 8]);
      doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.setFont(undefined, 'bold');
      doc.text(`Status: ${guest.status}`, 160, y + 3, null, null, 'right');
      
      y += 20;
    });

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('Please present this confirmation and your original ID documents upon check-in.', 105, 280, null, null, 'center');
    
    doc.save(`Lumina_Reservation_${reservation.reservationId}.pdf`);
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
                onChange={(v) => setBooking({ ...booking, checkInDate: v, checkOutDate: booking.checkOutDate && booking.checkOutDate < v ? '' : booking.checkOutDate })}
              />
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
          
          <button onClick={() => setStep(2)} className="w-full bg-[#1a365d] text-white py-4 rounded-sm font-bold tracking-widest uppercase hover:bg-[#2a4365] transition-colors flex items-center justify-center gap-2">
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
                const requiredRooms = Math.ceil(booking.guestCount / 2);
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
                            {requiredRooms > 1 && <span className="inline-block bg-[#1a365d]/10 text-[#1a365d] text-[10px] font-bold px-2 py-0.5 uppercase rounded tracking-wide mt-1">{requiredRooms} Rooms Required for {booking.guestCount} Guests</span>}
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-[#d4af37]">₹{(room.pricePerNight * requiredRooms).toLocaleString('en-IN')}</p>
                            <p className="text-xs text-gray-400 uppercase tracking-wide">total per night</p>
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 border-b border-gray-200 pb-10">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email (Primary Contact)</label>
                <input type="email" className={`w-full px-4 py-3 bg-gray-50 border ${errors.email ? 'border-red-500' : 'border-gray-200'} rounded-sm outline-none focus:border-[#d4af37]`}
                  placeholder="johndoe@example.com"
                  value={booking.email} onChange={e => setBooking({...booking, email: e.target.value})} />
                {errors.email && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {errors.email}</p>}
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

            <div className="flex items-center gap-3 mb-6">
              <ShieldCheck className="w-6 h-6 text-[#1a365d]" />
              <h3 className="text-2xl font-bold text-[#1a365d]">Pre-Arrival Verification</h3>
            </div>
            <p className="text-gray-600 mb-8 text-sm">
              Uploading government-issued IDs for all guests is mandatory. We use secure Setu Document Extraction to verify identities and auto-fill your details.
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
                      <div className="relative">
                        <select className="w-full px-4 py-3 bg-white border border-gray-300 rounded-sm outline-none focus:border-[#d4af37] appearance-none"
                          value={guest.idType} onChange={e => handleGuestChange(index, 'idType', e.target.value)}>
                          <option value="Aadhaar Card">Aadhaar Card</option>
                          <option value="Driving License">Driving License</option>
                          <option value="PAN Card">PAN Card</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                          </svg>
                        </div>
                      </div>
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
                          <Loader2 className="w-8 h-8 text-[#d4af37] animate-spin mb-2" />
                          <p className="text-sm font-medium text-gray-700">Extracting details from ID...</p>
                        </div>
                      ) : files[index] ? (
                        <div className="flex flex-col items-center">
                          <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
                          <p className="font-medium text-gray-900 text-sm">{files[index].name}</p>
                          <p className="text-xs text-green-600 mt-1">Details auto-filled above.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <UploadCloud className="w-8 h-8 text-gray-400 mb-2 group-hover:text-[#d4af37]" />
                          <p className="text-sm font-medium text-gray-700">Upload {guest.idType} image to Extract Details</p>
                          <p className="text-xs text-gray-500 mt-1">JPG, PNG up to 5MB</p>
                        </div>
                      )}
                    </div>
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
                  <p className="font-medium text-gray-900">1</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Guests</p>
                  <p className="font-medium text-gray-900">{booking.guestCount}</p>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">GST (18%)</span>
                <span className="font-medium">₹{gst.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-[#1a365d] pt-2 border-t border-gray-200 mt-2">
                <span>Total</span>
                <span>₹{finalTotal.toLocaleString('en-IN')}</span>
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
                  <ShieldCheck className={`w-6 h-6 mt-1 ${guest.status === 'Verified' ? 'text-green-500' : guest.status === 'Failed' ? 'text-red-500' : 'text-amber-500'}`} />
                  <div>
                    <p className="font-bold text-gray-900">{guest.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {guest.status === 'Verified' 
                        ? `ID Verified (${guest.idType}). Cleared for mobile key.`
                        : guest.status === 'Failed'
                        ? 'Verification failed or unreadable. See front desk.'
                        : 'No ID uploaded. Please see front desk upon arrival.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-center flex justify-center gap-4 mt-8">
            <button onClick={handleDownloadPDF} className="px-8 py-3 bg-[#d4af37] text-white font-bold tracking-widest uppercase text-sm shadow-md hover:bg-[#c5a028] transition-colors flex items-center gap-2">
              <Download className="w-5 h-5" /> Download PDF
            </button>
            <button onClick={() => navigate('/')} className="px-8 py-3 border-2 border-[#1a365d] text-[#1a365d] font-bold tracking-widest uppercase text-sm hover:bg-[#1a365d] hover:text-white transition-colors">
              Return Home
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default GuestPortal;
