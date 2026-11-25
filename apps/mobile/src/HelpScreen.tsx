import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from './theme';

const sections = [
  {
    title: 'Movimientos y organización',
    questions: [
      [
        '¿Cómo registro mis ingresos y gastos?',
        'En Movimientos, toca Añadir. Elige el tipo, la moneda y la categoría. Puedes dividir un gasto entre varias categorías.',
      ],
      [
        '¿Cómo registro una devolución y reviso su efecto?',
        'Abre el gasto en Movimientos y usa Devolución. Puedes devolver parte o todo el importe disponible. Analíticas y reportes muestra el efecto en los gastos netos y permite exportar el mes por moneda.',
      ],
      [
        '¿Cómo organizo mis categorías?',
        'En Configuración puedes administrar categorías y crear reglas por comercio. Al escribir una descripción que coincida con una regla, puedes usar la sugerencia o elegir otra categoría.',
      ],
      [
        '¿Cómo consulto mis presupuestos y ahorro?',
        'En el menú lateral encontrarás Presupuestos, Análisis y Metas de ahorro. Define límites por mes y categoría, revisa tus gastos y registra aportes a tus metas.',
      ],
    ],
  },
  {
    title: 'Pagos y planificación',
    questions: [
      [
        '¿Dónde reviso mis pagos pendientes?',
        'Abre Pagos y cobros pendientes y expande un registro. Usa el icono de lápiz para cambiar el importe de un abono manual. Si vinculaste un movimiento, su importe se actualiza desde Movimientos.',
      ],
      [
        '¿Cómo uso el cierre mensual?',
        'Abre Cierre mensual para revisar movimientos sin categorizar, pendientes y diferencias frente al presupuesto. Puedes guardar un resumen por mes y moneda.',
      ],
      [
        '¿Qué diferencia hay entre el simulador y el plan de pago?',
        'El simulador estima cuotas para un préstamo nuevo. Si dejas el plazo vacío, compara varios plazos. El plan de pago compara abonos adicionales para una tarjeta o un préstamo existente.',
      ],
    ],
  },
  {
    title: 'Cuentas, respaldo y notificaciones',
    questions: [
      [
        '¿Cómo registro cuentas y pago una tarjeta?',
        'En Configuración, abre Cuentas y saldos para crear cuentas de efectivo, banco o tarjeta. Para pagar una tarjeta, registra una transferencia desde una cuenta de la misma moneda. Disminuye la deuda de la tarjeta sin duplicar el gasto.',
      ],
      [
        '¿Cómo comparo mi saldo con el estado de cuenta?',
        'En Cuentas y saldos, toca Conciliar en la cuenta que quieras revisar. Indica la fecha y hora de corte y el importe del estado de cuenta. Puedes confirmar la diferencia como un ajuste de saldo en el historial.',
      ],
      [
        '¿Cómo guardo o recupero mi información?',
        'En Configuración, abre Respaldo y restauración. Exporta un archivo JSON con tus datos locales. Al seleccionar un respaldo, podrás revisar su contenido antes de reemplazar los datos de este dispositivo.',
      ],
      [
        '¿Cómo activo recordatorios de vencimiento?',
        'En Android, abre Configuración y entra en Notificaciones. Activa los recordatorios de pagos pendientes y plantillas mensuales. El aviso se cancela al saldar el pago o pausar la plantilla.',
      ],
    ],
  },
  {
    title: 'Bancos y acceso',
    questions: [
      [
        '¿Dónde consulto tasas y bancos?',
        'Busca Tasa del día en Configuración. Conversión se llena con las tasas USD y EUR de Frankfurter. Puedes editar cada tasa para tu cálculo o restaurar la publicada. En Mis bancos puedes registrar los bancos dominicanos que utilizas.',
      ],
      [
        '¿Qué puedo usar con la cuenta de prueba?',
        'Puedes llevar tus cuentas, movimientos, presupuestos y metas, simular préstamos y exportar reportes. Los datos de la cuenta de prueba se guardan en este dispositivo.',
      ],
    ],
  },
] as const;

export function HelpScreen() {
  const { styles: s, palette } = useTheme();
  const [open, setOpen] = useState<string>();
  return (
    <>
      {sections.map((section) => (
        <View key={section.title} style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={[s.label, { textAlign: 'left' }]}>
            {section.title}
          </Text>
          {section.questions.map(([question, answer]) => {
            const expanded = open === question;
            return (
              <View
                key={question}
                style={[
                  s.card,
                  { padding: 0, gap: 0, borderWidth: 0 },
                  expanded && { backgroundColor: palette.raised },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={question}
                  accessibilityState={{ expanded }}
                  onPress={() => setOpen(expanded ? undefined : question)}
                  style={({ pressed }) => [
                    {
                      minHeight: 56,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 14,
                      borderRadius: 16,
                    },
                    pressed && s.selected,
                  ]}
                >
                  <Text style={[s.text, { flex: 1, textAlign: 'left', fontWeight: '600' }]}>
                    {question}
                  </Text>
                  <View
                    importantForAccessibility="no-hide-descendants"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: palette.selected,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={[s.label, { color: palette.primary, fontSize: 18 }]}>
                      {expanded ? '−' : '+'}
                    </Text>
                  </View>
                </Pressable>
                {expanded && (
                  <Text
                    style={[
                      s.text,
                      {
                        color: palette.muted,
                        paddingHorizontal: 14,
                        paddingBottom: 16,
                        textAlign: 'left',
                      },
                    ]}
                  >
                    {answer}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </>
  );
}
