import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from './theme';

const questions = [
  [
    '¿Cómo registro mis ingresos y gastos?',
    'En Movimientos, toca Añadir. Elige el tipo, la moneda y la categoría. Puedes dividir un gasto entre varias categorías.',
  ],
  [
    '¿Cómo organizo mis categorías?',
    'En Configuración puedes administrar categorías y crear reglas por comercio. Al escribir una descripción que coincida con una regla, puedes usar la sugerencia o elegir otra categoría.',
  ],
  [
    '¿Cómo consulto mis presupuestos y ahorro?',
    'En el menú lateral encontrarás Presupuestos, Análisis y Metas de ahorro. Define límites por mes y categoría, revisa tus gastos y registra aportes a tus metas.',
  ],
  [
    '¿Dónde reviso mis pagos pendientes?',
    'Abre Pagos y cobros pendientes para registrar vencimientos, abonos y movimientos vinculados. Disponible hasta el próximo cobro usa tus gastos previstos para estimar cuánto puedes gastar.',
  ],
  [
    '¿Cómo uso el cierre mensual?',
    'Abre Cierre mensual para revisar movimientos sin categorizar, pendientes y diferencias frente al presupuesto. Puedes guardar un resumen por mes y moneda.',
  ],
  [
    '¿Qué diferencia hay entre el simulador y el plan de pago?',
    'El simulador estima cuotas para un préstamo nuevo. Si dejas el plazo vacío, compara varios plazos. El plan de pago compara abonos adicionales para una tarjeta o un préstamo existente.',
  ],
  [
    '¿Dónde consulto tasas y bancos?',
    'Tasa del día en Configuración muestra las tasas de referencia de USD y EUR. En Mis bancos puedes registrar los bancos dominicanos que utilizas y consultar sus opciones en Conexiones.',
  ],
  [
    '¿Qué puedo usar con la cuenta de prueba?',
    'Puedes registrar movimientos, presupuestos y metas, consultar el historial, simular préstamos y exportar CSV. Los datos de prueba se guardan en este dispositivo.',
  ],
] as const;

export function HelpScreen() {
  const { styles: s } = useTheme();
  const [open, setOpen] = useState<string>();
  return (
    <View style={s.card}>
      {questions.map(([question, answer]) => {
        const expanded = open === question;
        return (
          <View key={question}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={question}
              accessibilityState={{ expanded }}
              onPress={() => setOpen(expanded ? undefined : question)}
              style={({ pressed }) => [s.between, s.settingsOption, pressed && s.selected]}
            >
              <Text style={[s.text, { flexShrink: 1 }]}>{question}</Text>
              <Text accessible={false} style={s.muted}>
                {expanded ? '−' : '+'}
              </Text>
            </Pressable>
            {expanded && <Text style={s.muted}>{answer}</Text>}
          </View>
        );
      })}
    </View>
  );
}
