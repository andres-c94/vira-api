import 'dotenv/config';
import { PrismaClient, StructuralDifficulty } from '@prisma/client';

const prisma = new PrismaClient();

const missions: Array<{
  dayNumber: number;
  title: string;
  description: string;
  structuralDifficulty: StructuralDifficulty;
  xpReward: number;
}> = [
  { dayNumber: 1, title: 'Camina 15 minutos sin mirar el celular.', description: 'Haz una caminata breve sin revisar el telefono en ningun momento.', structuralDifficulty: 'EASY', xpReward: 20 },
  { dayNumber: 2, title: 'Lee durante 20 minutos sin distracciones.', description: 'Dedica 20 minutos continuos a leer sin redes ni interrupciones.', structuralDifficulty: 'EASY', xpReward: 20 },
  { dayNumber: 3, title: 'Sientate 10 minutos sin hacer nada.', description: 'Permanece quieto durante 10 minutos sin consumir contenido.', structuralDifficulty: 'EASY', xpReward: 20 },
  { dayNumber: 4, title: 'Trabaja 30 minutos en una tarea pendiente sin redes.', description: 'Elige una tarea pendiente y trabaja en ella media hora sin redes.', structuralDifficulty: 'MEDIUM', xpReward: 30 },
  { dayNumber: 5, title: 'Sal a un parque o cafe y permanece 30 minutos sin usar el celular.', description: 'Pasa 30 minutos fuera de casa sin usar el telefono.', structuralDifficulty: 'MEDIUM', xpReward: 30 },
  { dayNumber: 6, title: 'Escribe una reflexion de minimo 10 lineas sobre tu consumo digital.', description: 'Escribe una reflexion honesta sobre tu uso de contenido corto.', structuralDifficulty: 'MEDIUM', xpReward: 30 },
  { dayNumber: 7, title: 'Camina 40 minutos y observa activamente tu entorno.', description: 'Haz una caminata larga prestando atencion al entorno.', structuralDifficulty: 'MEDIUM', xpReward: 30 },
  { dayNumber: 8, title: 'Busca un grupo local de senderismo, lectura, dibujo o deporte.', description: 'Investiga una opcion real de grupo o actividad presencial.', structuralDifficulty: 'MEDIUM', xpReward: 30 },
  { dayNumber: 9, title: 'Guarda o contacta ese grupo.', description: 'Guarda el contacto o envia un mensaje al grupo encontrado.', structuralDifficulty: 'EASY', xpReward: 20 },
  { dayNumber: 10, title: 'Realiza 60 minutos de foco profundo, estudio o trabajo.', description: 'Haz una sesion de enfoque profundo de una hora.', structuralDifficulty: 'HARD', xpReward: 50 },
  { dayNumber: 11, title: 'Habla con una persona fuera de tu circulo habitual.', description: 'Inicia una conversacion breve con alguien fuera de tu rutina.', structuralDifficulty: 'HARD', xpReward: 50 },
  { dayNumber: 12, title: 'Pasa 90 minutos fuera sin consumir contenido corto.', description: 'Dedica 90 minutos fuera de la pantalla y del scroll corto.', structuralDifficulty: 'HARD', xpReward: 50 },
  { dayNumber: 13, title: 'Planea una actividad real para el fin de semana.', description: 'Deja definida una actividad concreta fuera de casa.', structuralDifficulty: 'MEDIUM', xpReward: 30 },
  { dayNumber: 14, title: 'Ejecuta una actividad fuera de casa y escribe una conclusion.', description: 'Haz la actividad planificada y cierra con una conclusion personal.', structuralDifficulty: 'HARD', xpReward: 50 }
];

async function main(): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "Program" ("id", "slug", "title", "description", "totalDays", "accessType", "betaInterestCount", "isActive", "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid(),
      'reset-dopamina-14-dias',
      'Reset Dopamina 14 días',
      'Programa de 14 días con misiones reales para reducir scroll infinito y recuperar foco.',
      14,
      'FREE',
      0,
      true,
      now(),
      now()
    )
    ON CONFLICT ("slug") DO UPDATE
    SET
      "title" = EXCLUDED."title",
      "description" = EXCLUDED."description",
      "totalDays" = EXCLUDED."totalDays",
      "accessType" = EXCLUDED."accessType",
      "isActive" = EXCLUDED."isActive",
      "updatedAt" = now()
  `;

  const [freeProgram] = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Program"
    WHERE "slug" = 'reset-dopamina-14-dias'
    LIMIT 1
  `;

  const betaPrograms: Array<{
    slug: string;
    title: string;
    description: string;
    totalDays: number;
  }> = [
    {
      slug: 'foco-real-21-dias',
      title: 'Foco Real · 21 días',
      description: 'Entrena bloques de foco profundo, reduce distracciones y recupera capacidad de trabajo sostenido.',
      totalDays: 21
    },
    {
      slug: 'vida-activa-30-dias',
      title: 'Vida Activa · 30 días',
      description: 'Misiones para salir más, explorar tu entorno y aumentar acción real fuera de pantalla.',
      totalDays: 30
    },
    {
      slug: 'control-21-dias',
      title: 'Control · 21 días',
      description: 'Ejercicios diarios para tolerar aburrimiento, controlar impulsos y reducir dependencia de estímulos rápidos.',
      totalDays: 21
    }
  ];

  for (const betaProgram of betaPrograms) {
    await prisma.$executeRaw`
      INSERT INTO "Program" ("id", "slug", "title", "description", "totalDays", "accessType", "betaInterestCount", "isActive", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(),
        ${betaProgram.slug},
        ${betaProgram.title},
        ${betaProgram.description},
        ${betaProgram.totalDays},
        'LOCKED_BETA',
        0,
        true,
        now(),
        now()
      )
      ON CONFLICT ("slug") DO UPDATE
      SET
        "title" = EXCLUDED."title",
        "description" = EXCLUDED."description",
        "totalDays" = EXCLUDED."totalDays",
        "accessType" = EXCLUDED."accessType",
        "isActive" = EXCLUDED."isActive",
        "updatedAt" = now()
    `;
  }

  for (const mission of missions) {
    await prisma.programMission.upsert({
      where: {
        programId_dayNumber: {
          programId: freeProgram.id,
          dayNumber: mission.dayNumber
        }
      },
      update: {
        title: mission.title,
        description: mission.description,
        structuralDifficulty: mission.structuralDifficulty,
        xpReward: mission.xpReward,
        orderIndex: mission.dayNumber
      },
      create: {
        programId: freeProgram.id,
        dayNumber: mission.dayNumber,
        title: mission.title,
        description: mission.description,
        structuralDifficulty: mission.structuralDifficulty,
        xpReward: mission.xpReward,
        orderIndex: mission.dayNumber
      }
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
