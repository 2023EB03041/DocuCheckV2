import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, DoorOpen, Search, LogOut, CheckCircle2, X, FileText, ShieldCheck, User, ChevronDown, ChevronUp, BookOpen, CreditCard, Settings } from 'lucide-react';
import axios from 'axios';
import StaffLogin from './StaffLogin';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

const StaffDashboard = () => {
  const [user, setUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [activeTab, setActiveTab] = useState('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRes, setExpandedRes] = useState(null);
  const [inventoryView, setInventoryView] = useState('tier');
  const [documentModalUrl, setDocumentModalUrl] = useState(null);
  
  // User Management State
  const [newUser, setNewUser] = useState({ name: '', email: '', phone: '', username: '', password: '', role: 'Manager' });
  const [userMsg, setUserMsg] = useState({ type: '', text: '' });

  const toTitleCase = (str) => str ? str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()) : '';

  useEffect(() => {
    const storedUser = localStorage.getItem('staffUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  useEffect(() => {
    if (!user) return; // Don't fetch if not logged in
    
    const fetchData = async () => {
      try {
        const [roomsRes, resRes] = await Promise.all([
          axios.get(`${API_URL}/reservations/rooms`),
          axios.get(`${API_URL}/reservations`)
        ]);
        setRooms(roomsRes.data);
        setReservations(resRes.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('staffToken');
    localStorage.removeItem('staffUser');
    setUser(null);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserMsg({ type: '', text: '' });
    try {
      await axios.post(`${API_URL}/auth/register`, newUser);
      setUserMsg({ type: 'success', text: 'Manager created successfully!' });
      setNewUser({ name: '', email: '', phone: '', username: '', password: '', role: 'Manager' });
    } catch (err) {
      setUserMsg({ type: 'error', text: err.response?.data?.message || 'Error creating user' });
    }
  };

  const handleViewDocument = async (e, url) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('staffToken');
      const baseUrl = API_URL.replace(/\/api$/, '');
      const res = await axios.get(`${baseUrl}${url}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const blobUrl = URL.createObjectURL(res.data);
      setDocumentModalUrl(blobUrl);
    } catch (error) {
      console.error(error);
      alert(`Failed to securely fetch document: ${error.response?.data?.message || error.message}`);
      if (error.response && error.response.status === 401) {
        alert("Your session has expired. You will be logged out automatically.");
        handleLogout();
      }
    }
  };

  if (!user) {
    return <StaffLogin onLogin={setUser} />;
  }

  const occupiedRooms = rooms.filter(r => r.status === 'Occupied').length;
  const occupancyRate = rooms.length > 0 ? Math.round((occupiedRooms / rooms.length) * 100) : 0;

  // Calculate pre-verified guests (if ALL guests in a reservation are verified)
  const fullyVerifiedReservations = reservations.filter(r => 
    r.guests && r.guests.length > 0 && r.guests.every(g => g.status === 'Verified')
  ).length;

  const lowerQuery = searchQuery.toLowerCase();

  const filteredRooms = rooms.filter(room => {
    if (!searchQuery) return true;
    if (room.roomNumber && room.roomNumber.toString().includes(lowerQuery)) return true;
    if (room.type && room.type.toLowerCase().includes(lowerQuery)) return true;
    if (room.currentReservation && room.currentReservation.guests) {
      return room.currentReservation.guests.some(g => g.name && g.name.toLowerCase().includes(lowerQuery));
    }
    return false;
  });

  // Group rooms by tier or reservation
  const groupedRooms = filteredRooms.reduce((acc, room) => {
    let groupKey = room.type;
    if (inventoryView === 'reservation') {
       groupKey = (room.status === 'Occupied' && room.currentReservation) ? `Reservation: ${room.currentReservation.reservationId}` : 'Available Rooms';
    }
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(room);
    return acc;
  }, {});

  const allGuests = reservations.flatMap(res => 
    (res.guests || []).map((g, index) => {
      const roomIndex = Math.floor(index / 2);
      const roomNum = res.roomNumbers && res.roomNumbers.length > 0 ? res.roomNumbers[roomIndex] : res.roomNumber;
      return {
        ...g,
        reservationId: res.reservationId,
        roomType: res.roomType,
        roomNumber: roomNum,
        checkInDate: res.checkInDate,
        checkOutDate: res.checkOutDate
      };
    })
  );

  const filteredGuests = allGuests.filter(guest => {
    if (!searchQuery) return true;
    if (guest.name && guest.name.toLowerCase().includes(lowerQuery)) return true;
    if (guest.roomNumber && guest.roomNumber.toString().includes(lowerQuery)) return true;
    if (guest.idType && guest.idType.toLowerCase().includes(lowerQuery)) return true;
    return false;
  });

  const filteredReservations = reservations.filter(res => {
    if (!searchQuery) return true;
    if (res.reservationId && res.reservationId.toLowerCase().includes(lowerQuery)) return true;
    if (res.phone && res.phone.includes(lowerQuery)) return true;
    if (res.email && res.email.toLowerCase().includes(lowerQuery)) return true;
    return false;
  });

  const totalRevenue = reservations.reduce((sum, res) => sum + (res.totalPrice || 0), 0);
  const totalGuestsCount = allGuests.length;
  const totalVerifiedGuests = allGuests.filter(g => g.status === 'Verified').length;

  return (
    <div className="flex h-[calc(100vh-5rem)] bg-[#fcfbf9]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col shadow-sm z-10">
        <div className="p-6">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">Property Management</p>
          <nav className="space-y-1">
            <button onClick={() => setActiveTab('inventory')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md font-medium text-sm transition-colors ${activeTab === 'inventory' ? 'bg-[#1a365d] text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>
              <DoorOpen className="w-4 h-4" /> Room Inventory
            </button>
            <button onClick={() => setActiveTab('directory')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md font-medium text-sm transition-colors ${activeTab === 'directory' ? 'bg-[#1a365d] text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>
              <Users className="w-4 h-4" /> Guest Directory
            </button>
            <button onClick={() => setActiveTab('reservations')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md font-medium text-sm transition-colors ${activeTab === 'reservations' ? 'bg-[#1a365d] text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>
              <BookOpen className="w-4 h-4" /> Reservations
            </button>
            
            {user.role === 'Superuser' && (
              <>
                <button onClick={() => setActiveTab('reports')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md font-medium text-sm transition-colors ${activeTab === 'reports' ? 'bg-[#1a365d] text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <LayoutDashboard className="w-4 h-4" /> Reports
                </button>
                <div className="pt-6 pb-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Administration</p>
                </div>
                <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-md font-medium text-sm transition-colors ${activeTab === 'users' ? 'bg-[#1a365d] text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <ShieldCheck className="w-4 h-4" /> User Management
                </button>
              </>
            )}
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-gray-100">
          <div className="mb-4 px-4 py-3 bg-gray-50 rounded border border-gray-100">
            <p className="text-xs font-bold text-gray-800">{user.name}</p>
            <p className="text-[10px] font-bold text-[#d4af37] uppercase tracking-wider">{user.role}</p>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-gray-500 hover:text-red-600 rounded-md font-medium text-sm transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center z-0">
          <div>
            <h1 className="text-2xl font-serif font-bold text-[#1a365d]">Lumina PMS</h1>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Live Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search room or guest..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm outline-none focus:border-[#d4af37]" 
              />
            </div>
            <div className="w-10 h-10 bg-[#d4af37] text-white rounded-full flex items-center justify-center shadow-sm">
              <User className="w-5 h-5" />
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          <div className="max-w-7xl mx-auto">
            
            {activeTab === 'inventory' && (
              <>
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Occupancy</p>
                    <div className="flex items-end gap-2">
                      <p className="text-4xl font-serif text-[#1a365d]">{occupancyRate}%</p>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 mt-4 rounded-full overflow-hidden">
                      <div className="bg-[#d4af37] h-full" style={{ width: `${occupancyRate}%` }}></div>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Rooms Occupied</p>
                    <p className="text-4xl font-serif text-[#1a365d]">{occupiedRooms} <span className="text-lg text-gray-400">/ {rooms.length}</span></p>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Total Reservations</p>
                    <p className="text-4xl font-serif text-[#1a365d]">{reservations.length}</p>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Pre-Verified</p>
                    <p className="text-4xl font-serif text-green-600">{fullyVerifiedReservations}</p>
                  </div>
                </div>

                {/* Room Grid */}
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider text-xs">Room Inventory</h2>
                  <select 
                    className="border border-gray-200 bg-white text-sm py-1.5 px-3 rounded shadow-sm focus:outline-none focus:border-[#d4af37] text-gray-700 font-medium"
                    value={inventoryView}
                    onChange={(e) => setInventoryView(e.target.value)}
                  >
                    <option value="tier">Group by Room Tier</option>
                    <option value="reservation">Group by Reservation</option>
                  </select>
                </div>
                
                {loading ? (
                  <div className="text-center py-20 text-gray-500">Loading inventory...</div>
                ) : (
                  <div className="space-y-8">
                    {Object.entries(groupedRooms).map(([tier, tierRooms]) => (
                      <div key={tier}>
                        <h3 className="text-[#1a365d] font-serif font-bold text-lg mb-4 border-b border-gray-200 pb-2">{tier}</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                          {tierRooms.map(room => {
                            const isOccupied = room.status === 'Occupied' && room.currentReservation;
                            
                            // Get the guests for this specific room
                            let roomGuests = [];
                            if (isOccupied) {
                              const res = room.currentReservation;
                              roomGuests = (res.guests || []).filter((g, index) => {
                                const roomIndex = Math.floor(index / 2);
                                const assignedRoomNum = res.roomNumbers && res.roomNumbers.length > 0 ? res.roomNumbers[roomIndex] : res.roomNumber;
                                return assignedRoomNum === room.roomNumber;
                              });
                            }

                            // Pre-verified if all guests in THIS ROOM are verified
                            const isVerified = isOccupied && roomGuests.length > 0 && roomGuests.every(g => g.status === 'Verified');

                            return (
                              <div 
                                key={room._id} 
                                onClick={() => isOccupied && setSelectedRoom({...room, currentReservation: {...room.currentReservation, guests: roomGuests}})}
                                className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer h-32 flex flex-col justify-between group
                                  ${room.status === 'Available' ? 'bg-white border-gray-200 hover:border-blue-300' : 
                                    isOccupied ? 'bg-blue-50 border-blue-200 hover:border-blue-400 shadow-sm' : 
                                    'bg-gray-100 border-gray-300'}
                                `}
                              >
                                <div className="flex justify-between items-start">
                                  <span className="font-mono text-lg font-bold text-gray-900">{room.roomNumber}</span>
                                  {isVerified && (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center justify-between">
                                    <p className="text-[10px] text-gray-500 font-bold uppercase truncate">{room.type}</p>
                                    {isOccupied && <p className="text-[9px] text-blue-500 font-bold font-mono bg-blue-100 px-1 rounded">{room.currentReservation.reservationId}</p>}
                                  </div>
                                  <p className={`text-xs font-medium mt-1 truncate ${isOccupied ? 'text-blue-700' : 'text-gray-400'}`}>
                                    {isOccupied && roomGuests.length > 0 ? toTitleCase(roomGuests[0].name) : room.status}
                                    {isOccupied && roomGuests.length > 1 && ` (+${roomGuests.length - 1})`}
                                  </p>
                                </div>
                                {/* Hover indicator */}
                                {isOccupied && (
                                  <div className="absolute inset-0 bg-[#1a365d]/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="bg-white px-2 py-1 rounded text-[10px] font-bold text-[#1a365d] shadow-sm uppercase tracking-wider">View Details</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'directory' && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-6 uppercase tracking-wider text-xs">Guest Directory</h2>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-max">
                      <thead>
                        <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200">
                          <th className="p-4 font-bold">Guest Name</th>
                          <th className="p-4 font-bold">Demographics</th>
                          <th className="p-4 font-bold">Room</th>
                          <th className="p-4 font-bold">Dates</th>
                          <th className="p-4 font-bold">ID Document</th>
                          <th className="p-4 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredGuests.length > 0 ? filteredGuests.map((guest, i) => (
                          <tr key={i} className="hover:bg-gray-50 text-sm">
                            <td className="p-4 font-medium text-gray-900">{toTitleCase(guest.name)}</td>
                            <td className="p-4 text-gray-600">
                              {guest.age ? `${guest.age} Yrs` : '-'} <br/>
                              <span className="text-xs text-gray-400">{guest.sex || '-'}</span>
                            </td>
                            <td className="p-4 text-gray-600">
                              {guest.roomNumber ? <span className="font-bold text-gray-900">Room {guest.roomNumber}</span> : 'Pending'} <br/>
                              <span className="text-xs text-gray-400">{guest.roomType}</span>
                            </td>
                            <td className="p-4 text-gray-600">
                              {new Date(guest.checkInDate).toLocaleDateString()} to <br/> {new Date(guest.checkOutDate).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-gray-600">{guest.idType}</td>
                            <td className="p-4">
                              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                guest.status === 'Verified' ? 'bg-green-100 text-green-700' : 
                                guest.status === 'Failed' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700'
                              }`}>
                                {guest.status}
                              </span>
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan="6" className="p-8 text-center text-gray-500">No guests found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reservations' && (
              <div className="pb-10">
                <h2 className="text-lg font-bold text-gray-900 mb-6 uppercase tracking-wider text-xs">All Reservations</h2>
                
                <div className="space-y-4">
                  {filteredReservations.length > 0 ? filteredReservations.map((res) => {
                    const isExpanded = expandedRes === res._id;
                    const allVerified = res.guests && res.guests.every(g => g.status === 'Verified');
                    
                    return (
                      <div key={res._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300">
                        {/* Summary Header (Clickable) */}
                        <div 
                          className="p-5 flex flex-col md:flex-row items-center justify-between cursor-pointer hover:bg-gray-50"
                          onClick={() => setExpandedRes(isExpanded ? null : res._id)}
                        >
                          <div className="flex items-center gap-6 w-full md:w-auto">
                            <div>
                              <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">Res ID</p>
                              <p className="font-mono font-medium text-[#1a365d]">{res.reservationId}</p>
                            </div>
                            <div className="hidden md:block">
                              <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">Primary Contact</p>
                              <p className="font-medium text-gray-900">{res.phone || '-'}</p>
                            </div>
                            <div className="hidden sm:block">
                              <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">Dates</p>
                              <p className="text-gray-700 text-sm">{new Date(res.checkInDate).toLocaleDateString()} - {new Date(res.checkOutDate).toLocaleDateString()}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6 mt-4 md:mt-0 w-full md:w-auto justify-between md:justify-end">
                            <div className="flex items-center gap-2">
                              {allVerified ? (
                                <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> KYC Cleared</span>
                              ) : (
                                <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-3 py-1 rounded-full">Pending KYC</span>
                              )}
                            </div>
                            <div className="text-gray-400">
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 bg-gray-50 p-6 grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-top-2 duration-200">
                            
                            {/* Left Column: Room & Payment */}
                            <div className="space-y-6">
                              <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 pb-2 mb-3">Room & Payment</h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-xs text-gray-500">Room Type</p>
                                    <p className="font-medium">{res.roomType}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Assigned Room(s)</p>
                                    <p className="font-medium text-[#1a365d]">{res.roomNumbers && res.roomNumbers.length > 0 ? `Room ${res.roomNumbers.join(', ')}` : res.roomNumber ? `Room ${res.roomNumber}` : 'Not Assigned'}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Total Paid</p>
                                    <p className="font-medium text-green-600 flex items-center gap-1"><CreditCard className="w-4 h-4"/> ₹{(res.totalPrice || 0).toLocaleString('en-IN')}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500">Email</p>
                                    <p className="text-sm">{res.email || '-'}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Right Column: Guest Manifest */}
                            <div>
                              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 pb-2 mb-3">Guest Manifest ({res.guests?.length || 0})</h4>
                              <div className="space-y-4">
                                {res.guests && res.guests.map((g, i) => (
                                  <div key={i} className="bg-white p-3 rounded border border-gray-200 shadow-sm flex flex-col gap-2">
                                    <div className="flex justify-between items-start">
                                      <p className="font-medium text-[#1a365d]">{toTitleCase(g.name)}</p>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        g.status === 'Verified' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                      }`}>
                                        {g.status}
                                      </span>
                                    </div>
                                    <div className="flex gap-4 text-xs text-gray-500">
                                      <p>Age: {g.age || '-'}</p>
                                      <p>Sex: {g.sex || '-'}</p>
                                      <p>ID: {g.idType}</p>
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                      {g.documentUrl && (
                                        <a 
                                          href="#" 
                                          onClick={(e) => handleViewDocument(e, g.documentUrl)}
                                          className="text-[10px] text-blue-600 hover:text-blue-800 underline font-medium flex items-center gap-1"
                                        >
                                          <FileText className="w-3 h-3" /> View ID Document
                                        </a>
                                      )}
                                      {g.verificationDetails && g.status === 'Verified' && (
                                        <p className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100 truncate ml-auto">
                                          OCR Match: {Math.round((g.verificationDetails.confidenceScore || 1) * 100)}%
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <div className="bg-white p-10 text-center text-gray-500 rounded-xl border border-gray-200 shadow-sm">
                      No reservations found matching your search.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'reports' && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-6 uppercase tracking-wider text-xs">Performance Reports</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Total Revenue</p>
                    <p className="text-4xl font-serif text-[#1a365d]">₹{totalRevenue.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Total Guests Managed</p>
                    <p className="text-4xl font-serif text-[#1a365d]">{totalGuestsCount}</p>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">ID Verification Rate</p>
                    <p className="text-4xl font-serif text-green-600">
                      {totalGuestsCount > 0 ? Math.round((totalVerifiedGuests / totalGuestsCount) * 100) : 0}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && user.role === 'Superuser' && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-6 uppercase tracking-wider text-xs">User Management</h2>
                
                <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm max-w-2xl">
                  <h3 className="text-md font-serif text-[#1a365d] mb-6 border-b border-gray-100 pb-3">Create New Manager Account</h3>
                  
                  {userMsg.text && (
                    <div className={`p-4 mb-6 rounded-sm text-sm border text-center ${userMsg.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                      {userMsg.text}
                    </div>
                  )}

                  <form onSubmit={handleCreateUser} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Full Name</label>
                        <input type="text" required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm focus:ring-2 focus:ring-[#d4af37] focus:border-transparent outline-none transition-all text-sm" placeholder="e.g. John Doe" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Email</label>
                        <input type="email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm focus:ring-2 focus:ring-[#d4af37] focus:border-transparent outline-none transition-all text-sm" placeholder="john@lumina.com" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Phone Number</label>
                        <input type="tel" required value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm focus:ring-2 focus:ring-[#d4af37] focus:border-transparent outline-none transition-all text-sm" placeholder="+91 9876543210" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Username</label>
                        <input type="text" required value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm focus:ring-2 focus:ring-[#d4af37] focus:border-transparent outline-none transition-all text-sm" placeholder="johndoe" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Temporary Password</label>
                        <input type="password" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-sm focus:ring-2 focus:ring-[#d4af37] focus:border-transparent outline-none transition-all text-sm" placeholder="Enter secure password" />
                      </div>
                    </div>
                    
                    <div className="pt-4 flex justify-end">
                      <button type="submit" className="bg-[#1a365d] text-white px-8 py-3 rounded-sm font-bold tracking-widest uppercase hover:bg-[#2a4365] transition-colors text-sm shadow-md">
                        Create Account
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Guest Details Modal/Slide-over */}
        {selectedRoom && selectedRoom.currentReservation && (
          <div className="absolute inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedRoom(null)}></div>
            <div className="w-full max-w-md bg-white h-full shadow-2xl relative z-10 animate-in slide-in-from-right duration-300 flex flex-col">
              <div className="bg-[#1a365d] p-6 text-white flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-serif font-bold mb-1">Room {selectedRoom.roomNumber}</h2>
                  <p className="text-blue-200 text-sm">{selectedRoom.type} &bull; ₹{selectedRoom.pricePerNight.toLocaleString('en-IN')}/night</p>
                </div>
                <button onClick={() => setSelectedRoom(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-8">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Reservation Details</h3>
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Check-in</p>
                        <p className="font-medium text-gray-900">{new Date(selectedRoom.currentReservation.checkInDate).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Check-out</p>
                        <p className="font-medium text-gray-900">{new Date(selectedRoom.currentReservation.checkOutDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Contact Email</p>
                      <p className="font-medium text-gray-900">{selectedRoom.currentReservation.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Contact Phone</p>
                      <p className="font-medium text-gray-900">{selectedRoom.currentReservation.phone || 'N/A'}</p>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-500 uppercase">Total Pre-paid</p>
                      <p className="font-bold text-gray-900 text-lg">₹{selectedRoom.currentReservation.totalPrice.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Guest Verification ({selectedRoom.currentReservation.guests.length})</h3>
                  
                  <div className="space-y-4">
                    {selectedRoom.currentReservation.guests.map((guest, index) => (
                      <div key={index} className={`p-4 rounded-lg border ${
                        guest.status === 'Verified' ? 'bg-green-50 border-green-200' :
                        guest.status === 'Failed' ? 'bg-red-50 border-red-200' :
                        'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <ShieldCheck className={`w-6 h-6 ${
                              guest.status === 'Verified' ? 'text-green-600' :
                              guest.status === 'Failed' ? 'text-red-600' :
                              'text-gray-400'
                            }`} />
                            <div>
                              <p className="font-bold text-gray-900">{toTitleCase(guest.name)}</p>
                              <p className="text-xs text-gray-500 uppercase">{guest.idType}</p>
                            </div>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            guest.status === 'Verified' ? 'bg-green-100 text-green-700' : 
                            guest.status === 'Failed' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700'
                          }`}>
                            {guest.status}
                          </span>
                        </div>
                        
                        {guest.documentUrl ? (
                          <div className="mt-4 border-t border-black/5 pt-4">
                            <p className="text-xs text-gray-500 uppercase mb-2">Uploaded Document</p>
                            <a 
                              href="#" 
                              onClick={(e) => handleViewDocument(e, guest.documentUrl)}
                              className="flex items-center gap-2 p-3 bg-white rounded border border-gray-200 hover:border-blue-400 transition-colors group cursor-pointer"
                            >
                              <FileText className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                              <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">View Scan</span>
                            </a>
                            
                            {guest.verificationDetails && (
                              <div className="mt-3 bg-white/50 p-3 rounded text-xs text-gray-600 space-y-1 border border-white/40">
                                <p><strong>OCR Match:</strong> {guest.verificationDetails.extractedName || 'N/A'}</p>
                                <p><strong>Confidence:</strong> {Math.round((guest.verificationDetails.confidenceScore || 0) * 100)}%</p>
                                <p><strong>System Note:</strong> {guest.verificationDetails.remarks}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 mt-2 border-t border-black/5 pt-2">No document uploaded.</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
              <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
                 <button className="flex-1 py-3 bg-white border border-gray-300 rounded-md font-bold text-sm text-gray-700 hover:bg-gray-100 transition-colors">Edit Booking</button>
                 <button 
                   disabled={!selectedRoom.currentReservation.guests.every(g => g.status === 'Verified')}
                   title={!selectedRoom.currentReservation.guests.every(g => g.status === 'Verified') ? "All guests must be verified before issuing keys" : ""}
                   className={`flex-1 py-3 rounded-md font-bold text-sm text-white transition-colors ${
                     selectedRoom.currentReservation.guests.every(g => g.status === 'Verified') 
                       ? 'bg-[#1a365d] hover:bg-[#2a4365]' 
                       : 'bg-gray-300 cursor-not-allowed opacity-70'
                   }`}
                 >
                    Issue Mobile Keys
                 </button>
              </div>
            </div>
          </div>
        )}

        {/* Secure Document Modal */}
        {documentModalUrl && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-200">
              <button 
                onClick={() => {
                  URL.revokeObjectURL(documentModalUrl);
                  setDocumentModalUrl(null);
                }}
                className="absolute -top-12 right-0 p-2 text-white hover:text-red-400 transition-colors bg-white/10 hover:bg-white/20 rounded-full"
                title="Close Secure View"
              >
                <X className="w-8 h-8" />
              </button>
              
              <div 
                className="relative overflow-hidden rounded-lg bg-gray-900 w-full flex justify-center shadow-2xl ring-1 ring-white/10"
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
                onSelect={(e) => e.preventDefault()}
              >
                {/* Invisible overlay to block right-clicks and drags on the image itself */}
                <div className="absolute inset-0 z-10 bg-transparent pointer-events-auto" onContextMenu={(e) => e.preventDefault()}></div>
                
                <img 
                  src={documentModalUrl} 
                  alt="Secure Document Scan" 
                  className="max-w-full max-h-[80vh] object-contain select-none"
                  style={{ 
                    WebkitUserSelect: 'none', 
                    userSelect: 'none',
                    pointerEvents: 'none'
                  }} 
                />
              </div>
              <p className="text-white/60 text-xs mt-4 text-center font-medium tracking-wide flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                SECURE DOCUMENT VIEW &bull; DOWNLOADING, COPYING, AND RIGHT-CLICKING ARE DISABLED
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default StaffDashboard;
