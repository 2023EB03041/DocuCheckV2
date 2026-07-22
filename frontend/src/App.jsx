import { Routes, Route, Link } from 'react-router-dom';
import GuestPortal from './pages/GuestPortal';
import StaffDashboard from './pages/StaffDashboard';

function App() {
  return (
    <div className="min-h-screen flex flex-col font-sans">
      <nav className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 100 100" className="h-12 w-12 text-[#d4af37] drop-shadow-sm" fill="currentColor">
                <path d="M50 5 L55 35 L85 15 L65 45 L95 50 L65 55 L85 85 L55 65 L50 95 L45 65 L15 85 L35 55 L5 50 L35 45 L15 15 L45 35 Z" />
                <circle cx="50" cy="50" r="15" fill="#1a365d" />
              </svg>
              <div className="flex flex-col">
                <span className="font-serif font-bold text-2xl text-[#1a365d] tracking-tight leading-none">LUMINA</span>
                <span className="text-[10px] tracking-[0.2em] text-[#d4af37] font-semibold uppercase">Resort & Spa</span>
              </div>
            </div>
            <div className="flex space-x-2 items-center">
              <Link to="/" className="text-gray-600 hover:text-white hover:bg-[#1a365d] px-6 py-2.5 rounded-full transition-all duration-300 font-bold text-xs tracking-[0.15em] uppercase">GUEST</Link>
              <Link to="/staff" className="text-gray-600 hover:text-white hover:bg-[#1a365d] px-6 py-2.5 rounded-full transition-all duration-300 font-bold text-xs tracking-[0.15em] uppercase">STAFF</Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 bg-[#fcfbf9]">
        <Routes>
          <Route path="/" element={
            <div className="w-full">
              {/* Hero Section */}
              <div className="relative h-[90vh] overflow-hidden group">
                <div 
                  className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-[30s] ease-out group-hover:scale-110" 
                  style={{ backgroundImage: 'url(/hero_bg.jpg)' }}
                >
                  <div className="absolute inset-0 bg-black/20"></div>
                </div>
                
                <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 text-center mt-10">
                  <div className="backdrop-blur-md bg-white/10 border border-white/20 p-12 md:p-20 rounded-3xl shadow-2xl flex flex-col items-center max-w-4xl transform transition-all duration-1000 hover:bg-white/20">
                    <span className="text-[#d4af37] tracking-[0.5em] uppercase text-xs md:text-sm font-bold mb-6 drop-shadow-md flex items-center gap-4">
                      <span className="w-12 h-[1px] bg-[#d4af37]"></span>
                      Welcome to Tranquility
                      <span className="w-12 h-[1px] bg-[#d4af37]"></span>
                    </span>
                    
                    <h1 className="text-5xl md:text-8xl font-serif font-bold text-white mb-6 leading-tight drop-shadow-2xl">
                      Find Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f9d976] to-[#e1b84f] italic font-light drop-shadow-sm">Serenity</span>
                    </h1>
                    
                    <p className="text-lg md:text-xl text-gray-100 mb-12 max-w-2xl font-light tracking-wider drop-shadow-md leading-relaxed">
                      Experience world-class luxury with seamless pre-arrival verification. Skip the front desk and step straight into elegance.
                    </p>
                    
                    <Link to="/book" className="group relative px-12 py-5 rounded-sm bg-gradient-to-r from-[#d4af37] to-[#c5a028] text-white font-bold tracking-[0.2em] uppercase text-sm shadow-[0_0_40px_rgba(212,175,55,0.4)] hover:shadow-[0_0_60px_rgba(212,175,55,0.6)] transition-all duration-500 overflow-hidden">
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>
                      <span className="relative z-10">Book Your Stay</span>
                    </Link>
                  </div>
                </div>
              </div>
              
              {/* Immersive Experiences Section (Alternating) */}
              <div className="py-24 bg-white overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-32">
                  
                  {/* Feature 1 */}
                  <div className="flex flex-col md:flex-row items-center gap-16 group">
                    <div className="w-full md:w-1/2 overflow-hidden rounded-sm shadow-2xl relative">
                      <div className="absolute inset-0 bg-[#1a365d]/10 z-10 group-hover:bg-transparent transition-colors duration-700"></div>
                      <img src="/infinity_pool.jpg" alt="Infinity Pool" className="w-full h-[500px] object-cover transition-transform duration-[10s] group-hover:scale-110" />
                    </div>
                    <div className="w-full md:w-1/2 md:pl-8">
                      <span className="text-[#d4af37] uppercase tracking-widest text-xs font-bold mb-4 block">Unwind</span>
                      <h2 className="text-4xl font-serif text-[#1a365d] mb-6 leading-tight">The Horizon Awaits</h2>
                      <p className="text-gray-600 font-light leading-relaxed mb-8 text-lg">
                        Immerse yourself in our signature infinity pool, designed to blend seamlessly with the azure ocean beyond. Sip handcrafted cocktails at the swim-up bar as you watch the spectacular golden hour sunset paint the sky.
                      </p>
                      <button className="text-[#1a365d] border-b border-[#1a365d] pb-1 font-bold uppercase tracking-wider text-sm hover:text-[#d4af37] hover:border-[#d4af37] transition-colors">Discover Amenities</button>
                    </div>
                  </div>

                  {/* Feature 2 */}
                  <div className="flex flex-col md:flex-row-reverse items-center gap-16 group">
                    <div className="w-full md:w-1/2 overflow-hidden rounded-sm shadow-2xl relative">
                      <div className="absolute inset-0 bg-[#1a365d]/10 z-10 group-hover:bg-transparent transition-colors duration-700"></div>
                      <img src="/fine_dining.jpg" alt="Fine Dining" className="w-full h-[500px] object-cover transition-transform duration-[10s] group-hover:scale-110" />
                    </div>
                    <div className="w-full md:w-1/2 md:pr-8">
                      <span className="text-[#d4af37] uppercase tracking-widest text-xs font-bold mb-4 block">Savor</span>
                      <h2 className="text-4xl font-serif text-[#1a365d] mb-6 leading-tight">Culinary Mastery</h2>
                      <p className="text-gray-600 font-light leading-relaxed mb-8 text-lg">
                        Dine under the stars at our award-winning waterfront restaurant. Our Michelin-starred chefs craft exquisite tasting menus using the finest local ingredients, perfectly paired with selections from our subterranean wine cellar.
                      </p>
                      <button className="text-[#1a365d] border-b border-[#1a365d] pb-1 font-bold uppercase tracking-wider text-sm hover:text-[#d4af37] hover:border-[#d4af37] transition-colors">View Menus</button>
                    </div>
                  </div>

                  {/* Feature 3 */}
                  <div className="flex flex-col md:flex-row items-center gap-16 group">
                    <div className="w-full md:w-1/2 overflow-hidden rounded-sm shadow-2xl relative">
                      <div className="absolute inset-0 bg-[#1a365d]/10 z-10 group-hover:bg-transparent transition-colors duration-700"></div>
                      <img src="/luxury_spa.jpg" alt="Luxury Spa" className="w-full h-[500px] object-cover transition-transform duration-[10s] group-hover:scale-110" />
                    </div>
                    <div className="w-full md:w-1/2 md:pl-8">
                      <span className="text-[#d4af37] uppercase tracking-widest text-xs font-bold mb-4 block">Rejuvenate</span>
                      <h2 className="text-4xl font-serif text-[#1a365d] mb-6 leading-tight">Holistic Wellness</h2>
                      <p className="text-gray-600 font-light leading-relaxed mb-8 text-lg">
                        Find your inner balance at the Serenity Spa. Surrounded by lush bamboo and the gentle sound of flowing water, experience ancient healing traditions fused with modern therapeutic practices in absolute privacy.
                      </p>
                      <button className="text-[#1a365d] border-b border-[#1a365d] pb-1 font-bold uppercase tracking-wider text-sm hover:text-[#d4af37] hover:border-[#d4af37] transition-colors">Book a Treatment</button>
                    </div>
                  </div>
                  
                </div>
              </div>
              
              {/* Resort Accommodations Section */}
              <div className="py-24 bg-[#f8f9fa] border-t border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="text-center mb-20">
                    <span className="text-[#d4af37] tracking-[0.3em] uppercase text-sm font-bold mb-4 block">Your Retreat</span>
                    <h2 className="text-5xl font-serif text-[#1a365d] mb-6">Luxurious Accommodations</h2>
                    <div className="w-20 h-1 bg-[#d4af37] mx-auto opacity-70"></div>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-12">
                    <div className="group cursor-pointer bg-white p-4 shadow-sm hover:shadow-xl transition-all duration-500 rounded-sm">
                      <div className="overflow-hidden mb-6 rounded-sm relative">
                        <div className="absolute inset-0 bg-[#1a365d]/20 z-10 group-hover:opacity-0 transition-opacity duration-500"></div>
                        <img src="/room_ocean.jpg" alt="Ocean View" className="w-full h-72 object-cover group-hover:scale-110 transition-transform duration-1000" />
                      </div>
                      <div className="px-2 pb-2">
                        <h3 className="text-2xl font-serif text-[#1a365d] mb-3 group-hover:text-[#d4af37] transition-colors">Oceanfront Suite</h3>
                        <p className="text-gray-500 font-light leading-relaxed">Wake up to the gentle sound of waves. Our ocean view suites offer unobstructed panoramas of the crystal blue waters and a private balcony.</p>
                      </div>
                    </div>
                    <div className="group cursor-pointer bg-white p-4 shadow-sm hover:shadow-xl transition-all duration-500 rounded-sm">
                      <div className="overflow-hidden mb-6 rounded-sm relative">
                        <div className="absolute inset-0 bg-[#1a365d]/20 z-10 group-hover:opacity-0 transition-opacity duration-500"></div>
                        <img src="/room_deluxe.jpg" alt="Deluxe Room" className="w-full h-72 object-cover group-hover:scale-110 transition-transform duration-1000" />
                      </div>
                      <div className="px-2 pb-2">
                        <h3 className="text-2xl font-serif text-[#1a365d] mb-3 group-hover:text-[#d4af37] transition-colors">Deluxe Villa</h3>
                        <p className="text-gray-500 font-light leading-relaxed">Nestled in tropical gardens, featuring a private plunge pool and expansive indoor-outdoor living spaces for the ultimate retreat.</p>
                      </div>
                    </div>
                    <div className="group cursor-pointer bg-white p-4 shadow-sm hover:shadow-xl transition-all duration-500 rounded-sm">
                      <div className="overflow-hidden mb-6 rounded-sm relative">
                        <div className="absolute inset-0 bg-[#1a365d]/20 z-10 group-hover:opacity-0 transition-opacity duration-500"></div>
                        <img src="/room_presidential.jpg" alt="Presidential Suite" className="w-full h-72 object-cover group-hover:scale-110 transition-transform duration-1000" />
                      </div>
                      <div className="px-2 pb-2">
                        <h3 className="text-2xl font-serif text-[#1a365d] mb-3 group-hover:text-[#d4af37] transition-colors">Presidential Penthouse</h3>
                        <p className="text-gray-500 font-light leading-relaxed">The pinnacle of luxury. Features a wraparound terrace, private chef's kitchen, dedicated butler service, and panoramic ocean vistas.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Footer Section */}
              <footer className="bg-[#1a365d] text-white pt-20 pb-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                    <div className="md:col-span-1">
                      <div className="flex items-center gap-3 mb-6">
                        <svg viewBox="0 0 100 100" className="h-8 w-8 text-[#d4af37]" fill="currentColor">
                          <path d="M50 5 L55 35 L85 15 L65 45 L95 50 L65 55 L85 85 L55 65 L50 95 L45 65 L15 85 L35 55 L5 50 L35 45 L15 15 L45 35 Z" />
                          <circle cx="50" cy="50" r="15" fill="white" />
                        </svg>
                        <span className="font-serif font-bold text-xl tracking-tight">LUMINA</span>
                      </div>
                      <p className="text-gray-300 font-light text-sm leading-relaxed mb-6">
                        Experience world-class luxury and seamless pre-arrival verification. Skip the front desk and go straight to serenity.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="font-bold uppercase tracking-wider text-sm mb-6 text-[#d4af37]">Explore</h4>
                      <ul className="space-y-3 text-sm text-gray-300 font-light">
                        <li><a href="#" className="hover:text-white transition-colors">Accommodations</a></li>
                        <li><a href="#" className="hover:text-white transition-colors">Dining</a></li>
                        <li><a href="#" className="hover:text-white transition-colors">Spa & Wellness</a></li>
                        <li><a href="#" className="hover:text-white transition-colors">Experiences</a></li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-bold uppercase tracking-wider text-sm mb-6 text-[#d4af37]">Contact</h4>
                      <ul className="space-y-3 text-sm text-gray-300 font-light">
                        <li>Beach Road, Morjim</li>
                        <li>North Goa, Goa 403512, India</li>
                        <li className="pt-2"><a href="tel:+919876543210" className="hover:text-white transition-colors">+91 98765 43210</a></li>
                        <li><a href="mailto:reservations@lumina.com" className="hover:text-white transition-colors">reservations@lumina.com</a></li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-bold uppercase tracking-wider text-sm mb-6 text-[#d4af37]">Newsletter</h4>
                      <p className="text-gray-300 font-light text-sm mb-4">Subscribe to receive exclusive offers and news.</p>
                      <div className="flex border border-gray-600 rounded-sm overflow-hidden">
                        <input type="email" placeholder="Your email address" className="bg-transparent px-4 py-2 w-full text-sm outline-none text-white placeholder-gray-400" />
                        <button className="bg-[#d4af37] text-[#1a365d] px-4 font-bold text-xs uppercase tracking-wider hover:bg-[#c5a028] transition-colors">Subscribe</button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-700 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} Lumina Resort & Spa. All rights reserved.</p>
                    <div className="flex gap-6 text-xs text-gray-400">
                      <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                      <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                      <a href="#" className="hover:text-white transition-colors">Sitemap</a>
                    </div>
                  </div>
                </div>
              </footer>
            </div>
          } />
          <Route path="/book" element={<GuestPortal />} /> 
          <Route path="/staff" element={<StaffDashboard />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
