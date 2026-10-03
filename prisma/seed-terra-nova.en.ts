/**
 * English copies of the Terra Nova services (F27) and the services shown first
 * in the catalogue (F28). French stays the base text in `seed-terra-nova.ts`;
 * the same values are written to existing databases by the
 * `20261003120000_wave_2_services_and_reports` migration.
 */

export interface ServiceTranslation {
  readonly name: string;
  readonly category: string;
  readonly summary: string;
  readonly description: string;
  readonly howTo: string;
  readonly hours: string;
}

export const FEATURED_SERVICES: readonly string[] = ["etat-civil", "logement", "sante"];

export const SERVICE_TRANSLATIONS_EN: Readonly<Record<string, ServiceTranslation>> = {
  "etat-civil": {
    name: "Civil registry and citizenship",
    category: "Procedures",
    summary: "Registering new residents, births, unions and resident cards.",
    description: "The civil registry keeps the register of Terra Nova's residents. It issues the resident card, records births and unions, and updates your file when you move to another housing module.",
    howTo: "1. Create your account on the portal.\n2. Send a request to the service saying which procedure you need.\n3. An agent tells you which documents to bring and gives you an appointment at the Central Dome.",
    hours: "Monday to Friday, 8 am – 5 pm (city time)",
  },
  "energie": {
    name: "Energy and solar grid",
    category: "Infrastructure",
    summary: "Grid connection, outages, meters and planned power cuts.",
    description: "The energy service runs the solar farms, the city's batteries and the supply to every module. It steps in when there is an outage and publishes planned power cuts in the announcements.",
    howTo: "For an outage, send a request with your sector and module number. Life-threatening emergencies go through the safety line.",
    hours: "On call 24/7 for outages",
  },
  "eau-oxygene": {
    name: "Water and oxygen",
    category: "Infrastructure",
    summary: "Water recycling, air quality and pressurisation alerts.",
    description: "This service recycles water, produces oxygen and keeps the domes pressurised. It checks the air quality in every sector and publishes the results each week.",
    howTo: "Report any drop in pressure, smell or leak with a request. If an alarm goes off, follow the instructions shown in your module.",
    hours: "On call 24/7",
  },
  "transports": {
    name: "Transport and shuttles",
    category: "Daily life",
    summary: "Shuttles between domes, timetables, passes and lost property.",
    description: "Pressurised shuttles link the residential domes, the greenhouses and the spaceport. The service runs the timetables, the passes and lost property.",
    howTo: "Timetables are published in the announcements. For a pass or a lost item, send a request to the service.",
    hours: "Shuttles 5 am – 1 am · desk 9 am – 6 pm",
  },
  "sante": {
    name: "Health centre",
    category: "Health and social care",
    summary: "Consultations, adapting to low gravity and medical follow-up.",
    description: "The health centre welcomes residents for consultations, adaptation medicine (low gravity, radiation) and vaccinations. It also coordinates psychological support for newcomers.",
    howTo: "Book an appointment with a request. In an emergency, go straight to the centre or call the safety line.",
    hours: "Every day, 7 am – 9 pm · emergencies 24/7",
  },
  "logement": {
    name: "Housing and modules",
    category: "Procedures",
    summary: "Allocating housing modules, repairs and moving sector.",
    description: "The housing service allocates housing modules, organises repairs and handles requests to move to another sector.",
    howTo: "Describe what you need (repair, move, flat share) in a request. Include your module number.",
    hours: "Monday to Friday, 9 am – 5 pm",
  },
  "proprete-recyclage": {
    name: "Cleanliness and recycling",
    category: "Daily life",
    summary: "Collection, sorting and reuse: nothing goes to waste on Terra Nova.",
    description: "On another planet, every resource counts. The service organises waste collection, sorting and reuse, and helps residents get the right habits.",
    howTo: "Check the collection calendar in the announcements. For bulky items or a collection problem, send a request.",
    hours: "Collections from 6 am to noon",
  },
  "education": {
    name: "Schools and training",
    category: "Health and social care",
    summary: "School enrolment, newcomer training and the library.",
    description: "The education service handles enrolment at the city school, the compulsory training for newcomers (safety, survival, pressurisation) and the digital library.",
    howTo: "To enrol a child, send a request with the child's age and your sector.",
    hours: "Monday to Friday, 8 am – 4 pm",
  },
  "serres-alimentation": {
    name: "Greenhouses and food",
    category: "Daily life",
    summary: "Greenhouse produce, food boxes and community gardens.",
    description: "The hydroponic greenhouses feed the city. The service hands out food boxes and allocates plots in the community gardens.",
    howTo: "Sign up for food boxes or ask for a plot with a request to the service.",
    hours: "Distribution every day, 10 am – 7 pm",
  },
  "securite": {
    name: "Safety and civil protection",
    category: "Safety",
    summary: "Alerts, evacuation drills, dust storms and airlock safety.",
    description: "Civil protection prepares the city for dust storms, depressurisation and evacuations. It publishes alerts and runs the drills.",
    howTo: "In immediate danger, use the alert terminals. For a question or a non-urgent report, send a request.",
    hours: "24/7",
  },
};
