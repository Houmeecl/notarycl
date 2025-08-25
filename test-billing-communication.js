/**
 * Test script for billing communication identifier processing
 * 
 * This script tests the billing communication system with the specific
 * identifier: bc-5e21459e-c717-463a-b2f1-0f12ab7abbe4
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const TEST_IDENTIFIER = 'bc-5e21459e-c717-463a-b2f1-0f12ab7abbe4';

// Test user credentials (you may need to register first)
const testUser = {
  email: 'test@notarypro.com',
  password: 'testpassword123',
  fullName: 'Usuario Test'
};

async function login() {
  try {
    console.log('🔐 Iniciando sesión...');
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    
    if (response.data.token) {
      console.log('✅ Sesión iniciada exitosamente');
      return response.data.token;
    } else {
      throw new Error('No se recibió token de autenticación');
    }
  } catch (error) {
    console.log('❌ Error en login, intentando registrar usuario...');
    return await register();
  }
}

async function register() {
  try {
    console.log('📝 Registrando nuevo usuario...');
    const response = await axios.post(`${BASE_URL}/api/auth/register`, testUser);
    
    if (response.data.token) {
      console.log('✅ Usuario registrado exitosamente');
      return response.data.token;
    } else {
      throw new Error('No se recibió token de registro');
    }
  } catch (error) {
    console.error('❌ Error registrando usuario:', error.response?.data || error.message);
    throw error;
  }
}

async function testBillingCommunicationIdentifier(token) {
  try {
    console.log(`\n📧 Probando identificador de comunicación: ${TEST_IDENTIFIER}`);
    
    // Test 1: Check identifier status
    console.log('\n🔍 Test 1: Verificando estado del identificador...');
    const statusResponse = await axios.get(
      `${BASE_URL}/api/billing-communication/test/${TEST_IDENTIFIER}`
    );
    console.log('✅ Estado del identificador:', statusResponse.data);

    // Test 2: Process billing communication with demo data
    console.log('\n📤 Test 2: Procesando comunicación de confirmación de pago...');
    const processResponse = await axios.post(
      `${BASE_URL}/api/billing-communication/process/${TEST_IDENTIFIER}`,
      {
        type: 'payment_confirmation',
        documentId: 'DOC-TEST-' + Date.now(),
        variables: {
          documentTitle: 'Contrato de Servicios Notariales',
          paymentAmount: 75000
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Comunicación procesada:', processResponse.data);

    // Test 3: Process payment failed communication
    console.log('\n❌ Test 3: Procesando comunicación de pago fallido...');
    const failedResponse = await axios.post(
      `${BASE_URL}/api/billing-communication/process/${TEST_IDENTIFIER}`,
      {
        type: 'payment_failed',
        documentId: 'DOC-TEST-' + Date.now(),
        variables: {
          documentTitle: 'Documento de Poder Legal',
          paymentAmount: 45000,
          failureReason: 'Tarjeta de crédito rechazada'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Comunicación de fallo procesada:', failedResponse.data);

    // Test 4: Process payment reminder
    console.log('\n⏰ Test 4: Procesando recordatorio de pago...');
    const reminderResponse = await axios.post(
      `${BASE_URL}/api/billing-communication/process/${TEST_IDENTIFIER}`,
      {
        type: 'payment_reminder',
        documentId: 'DOC-TEST-' + Date.now(),
        variables: {
          documentTitle: 'Certificación de Documento',
          paymentAmount: 30000,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CL')
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Recordatorio procesado:', reminderResponse.data);

    return true;
  } catch (error) {
    console.error('❌ Error en test de billing communication:', error.response?.data || error.message);
    return false;
  }
}

async function testWithPayment(token) {
  try {
    console.log('\n💳 Test con pago real: Creando pago de prueba...');
    
    // Create a payment intent
    const paymentResponse = await axios.post(
      `${BASE_URL}/api/payments/create`,
      {
        amount: 50000,
        currency: 'CLP',
        description: 'Pago de prueba para comunicación de facturación',
        metadata: {
          documentId: 'DOC-TEST-' + Date.now(),
          type: 'document'
        },
        providerId: 'stripe'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const paymentId = paymentResponse.data.paymentIntent.id;
    console.log('✅ Pago creado:', paymentId);

    // Process billing communication with real payment
    console.log('\n📧 Procesando comunicación con pago real...');
    const commResponse = await axios.post(
      `${BASE_URL}/api/billing-communication/process/${TEST_IDENTIFIER}`,
      {
        type: 'payment_confirmation',
        paymentId: paymentId,
        variables: {
          documentTitle: 'Documento con Pago Real'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Comunicación con pago real procesada:', commResponse.data);

    return true;
  } catch (error) {
    console.error('❌ Error en test con pago:', error.response?.data || error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Iniciando tests del sistema de comunicación de facturación');
  console.log('=' .repeat(70));
  
  try {
    // Step 1: Authenticate
    const token = await login();
    
    // Step 2: Test billing communication identifier
    const basicTestSuccess = await testBillingCommunicationIdentifier(token);
    
    // Step 3: Test with real payment
    const paymentTestSuccess = await testWithPayment(token);
    
    // Summary
    console.log('\n' + '=' .repeat(70));
    console.log('📊 RESUMEN DE TESTS:');
    console.log(`   Identificador: ${TEST_IDENTIFIER}`);
    console.log(`   Tests básicos: ${basicTestSuccess ? '✅ EXITOSO' : '❌ FALLIDO'}`);
    console.log(`   Tests con pago: ${paymentTestSuccess ? '✅ EXITOSO' : '❌ FALLIDO'}`);
    console.log(`   Sistema: ${basicTestSuccess && paymentTestSuccess ? '🟢 FUNCIONANDO' : '🔴 CON ERRORES'}`);
    
    if (basicTestSuccess && paymentTestSuccess) {
      console.log('\n🎉 ¡Todos los tests pasaron exitosamente!');
      console.log('El identificador bc-5e21459e-c717-463a-b2f1-0f12ab7abbe4 está funcionando correctamente.');
    } else {
      console.log('\n⚠️ Algunos tests fallaron. Revisa los logs para más detalles.');
    }
    
  } catch (error) {
    console.error('❌ Error ejecutando tests:', error.message);
  }
}

// Execute if run directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testBillingCommunicationIdentifier,
  TEST_IDENTIFIER
};