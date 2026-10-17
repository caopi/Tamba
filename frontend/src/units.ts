// Unidades de medida na tela (UC007).
//
// A API e o banco falam SEMPRE em kg e cm. A preferência do usuário
// (`measurementUnit`) só muda o que aparece e o que se digita:
//   "kg" -> sistema métrico: quilos e centímetros;
//   "lb" -> sistema imperial: libras e polegadas.
// Mostrar converte de kg/cm para a unidade dele; digitar converte de volta
// antes de mandar para a API. Toda tela que mostra peso ou comprimento passa
// por aqui — nada de "kg" fixo no JSX.
//
// O formulário de espécie do admin é a exceção: o catálogo é editado em
// kg/cm, a unidade em que é guardado, para não acumular erro de conversão.

import { useAuth } from "./context/AuthContext";
import { formatarFaixa } from "./format";

const KG_POR_LIBRA = 0.45359237;
const CM_POR_POLEGADA = 2.54;

const numero = (valor: number, casas: number) =>
  valor.toLocaleString("pt-BR", { maximumFractionDigits: casas });

export function useUnidades() {
  const { user } = useAuth();
  const imperial = user?.measurementUnit === "lb";

  const rotuloPeso = imperial ? "lb" : "kg";
  const rotuloComprimento = imperial ? "pol" : "cm";
  /** kg -> unidade do usuário. */
  const pesoDe = (kg: number) => (imperial ? kg / KG_POR_LIBRA : kg);
  /** cm -> unidade do usuário. */
  const comprimentoDe = (cm: number) => (imperial ? cm / CM_POR_POLEGADA : cm);
  const ouNull = (valor: number | null, f: (v: number) => number) => (valor === null ? null : f(valor));

  return {
    imperial,
    rotuloPeso,
    rotuloComprimento,
    pesoDe,
    comprimentoDe,
    /** Unidade do usuário -> kg, para mandar à API. */
    pesoParaKg: (valor: number) => (imperial ? valor * KG_POR_LIBRA : valor),
    /** Unidade do usuário -> cm, para mandar à API. */
    comprimentoParaCm: (valor: number) => (imperial ? valor * CM_POR_POLEGADA : valor),
    /** "3,4 kg" ou "7,5 lb". */
    peso: (kg: number) => `${numero(pesoDe(kg), 2)} ${rotuloPeso}`,
    /** "52 cm" ou "20,5 pol". */
    comprimento: (cm: number) => `${numero(comprimentoDe(cm), 1)} ${rotuloComprimento}`,
    faixaPeso: (min: number | null, max: number | null) =>
      formatarFaixa(ouNull(min, pesoDe), ouNull(max, pesoDe), rotuloPeso),
    faixaComprimento: (min: number | null, max: number | null) =>
      formatarFaixa(ouNull(min, comprimentoDe), ouNull(max, comprimentoDe), rotuloComprimento),
  };
}
