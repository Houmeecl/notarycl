import { VercelRequest, VercelResponse } from '@vercel/node';

// Plantillas de demo para Vercel
const demoTemplates = [
  {
    id: "rental_contract",
    name: "Contrato de Arrendamiento",
    description: "Contrato estándar para arrendamiento de vivienda",
    category: "Contratos",
    formFields: [
      {
        id: "landlord_name",
        name: "landlordName",
        label: "Nombre del Arrendador",
        type: "text",
        required: true,
        validation: { minLength: 2, maxLength: 100 }
      },
      {
        id: "landlord_rut",
        name: "landlordRut",
        label: "RUT del Arrendador",
        type: "text",
        required: true,
        placeholder: "12.345.678-9"
      },
      {
        id: "tenant_name",
        name: "tenantName",
        label: "Nombre del Arrendatario",
        type: "text",
        required: true,
        validation: { minLength: 2, maxLength: 100 }
      },
      {
        id: "tenant_rut",
        name: "tenantRut",
        label: "RUT del Arrendatario",
        type: "text",
        required: true,
        placeholder: "12.345.678-9"
      },
      {
        id: "property_address",
        name: "propertyAddress",
        label: "Dirección de la Propiedad",
        type: "textarea",
        required: true,
        validation: { minLength: 10, maxLength: 500 }
      },
      {
        id: "monthly_rent",
        name: "monthlyRent",
        label: "Renta Mensual (CLP)",
        type: "number",
        required: true,
        validation: { min: 1000, max: 10000000 }
      },
      {
        id: "contract_start",
        name: "contractStart",
        label: "Fecha de Inicio",
        type: "date",
        required: true
      },
      {
        id: "contract_duration",
        name: "contractDuration",
        label: "Duración (meses)",
        type: "select",
        required: true,
        options: ["6", "12", "18", "24", "36"]
      }
    ],
    price: 15000,
    estimatedTime: 30,
    requiredDocuments: ["Cédula de Identidad", "Certificado de Ingresos"],
    legalRequirements: ["Firma ante notario", "Timbre fiscal"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true
  },
  {
    id: "power_of_attorney",
    name: "Poder Notarial",
    description: "Poder general para representación legal",
    category: "Poderes",
    formFields: [
      {
        id: "grantor_name",
        name: "grantorName",
        label: "Nombre del Otorgante",
        type: "text",
        required: true
      },
      {
        id: "grantor_rut",
        name: "grantorRut",
        label: "RUT del Otorgante",
        type: "text",
        required: true
      },
      {
        id: "attorney_name",
        name: "attorneyName",
        label: "Nombre del Apoderado",
        type: "text",
        required: true
      },
      {
        id: "attorney_rut",
        name: "attorneyRut",
        label: "RUT del Apoderado",
        type: "text",
        required: true
      },
      {
        id: "power_scope",
        name: "powerScope",
        label: "Alcance del Poder",
        type: "select",
        required: true,
        options: ["General", "Específico para Bienes Raíces", "Específico para Vehículos", "Específico para Trámites Bancarios"]
      },
      {
        id: "specific_powers",
        name: "specificPowers",
        label: "Poderes Específicos",
        type: "textarea",
        required: false,
        placeholder: "Detalle los poderes específicos si aplica"
      }
    ],
    price: 25000,
    estimatedTime: 45,
    requiredDocuments: ["Cédula de Identidad del Otorgante", "Cédula de Identidad del Apoderado"],
    legalRequirements: ["Firma ante notario", "Dos testigos"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true
  }
];

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { category } = req.query;
    
    let templates = demoTemplates;
    
    if (category) {
      templates = demoTemplates.filter(t => t.category === category);
    }
    
    res.status(200).json(templates);
  } catch (error) {
    console.error('Error obteniendo plantillas:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}