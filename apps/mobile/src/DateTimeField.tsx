import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { dominicanDateTime, parseDominicanDateTime } from '@flowsaldo/domain';
import { Choice } from './ui';
import { useTheme } from './theme';

export interface DateTimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  clearable?: boolean;
}

const timeZoneName = 'America/Santo_Domingo';

export function DateTimeField({ label, value, onChange, clearable }: DateTimeFieldProps) {
  const { styles: s } = useTheme();
  const [open, setOpen] = useState(false);
  const current = parseDominicanDateTime(value) ?? new Date();

  function pick() {
    if (Platform.OS !== 'android') {
      setOpen((visible) => !visible);
      return;
    }
    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      timeZoneName,
      onValueChange: (_event, selectedDate) => {
        DateTimePickerAndroid.open({
          value: selectedDate,
          mode: 'time',
          timeZoneName,
          is24Hour: true,
          onValueChange: (_timeEvent, combined) => {
            const day = dominicanDateTime(selectedDate).slice(0, 10);
            onChange(day + 'T' + dominicanDateTime(combined).slice(11));
          },
        });
      },
    });
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <Choice
        label={label}
        text={value ? value.replace('T', ' · ') : 'Elegir fecha y hora'}
        selected={open}
        onPress={pick}
      />
      {open && (
        <DateTimePicker
          value={current}
          mode="datetime"
          timeZoneName={timeZoneName}
          onValueChange={(_event, next) => onChange(dominicanDateTime(next))}
        />
      )}
      {clearable && !!value && (
        <Choice
          label={`Borrar ${label.toLowerCase()}`}
          selected={false}
          onPress={() => onChange('')}
        />
      )}
    </View>
  );
}
