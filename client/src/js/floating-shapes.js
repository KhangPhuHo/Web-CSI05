const { Engine, Render, World, Bodies, Body, Events, Mouse, MouseConstraint, Vector } = Matter;

const engine = Engine.create();
engine.enableSleeping = true;
engine.positionIterations = 4;
engine.velocityIterations = 4;
engine.timing.timeScale = 0.9;

const world = engine.world;
world.gravity.y = 0;

const render = Render.create({
  element: document.body,
  engine,
  options: {
    width: window.innerWidth,
    height: window.innerHeight,
    background: "transparent",
    wireframes: false,
    pixelRatio: Math.min(window.devicePixelRatio),
    antialias: false,
  },
});
Render.run(render);

const colors = ["#e63946", "#2a9d8f", "#f4a261", "#a8dadc", "#f77f00", "#3a86ff", "pink"];
const types = ["circle", "rectangle", "triangle"];
const shapeSize = 40;
const shapes = [];

const wrapper = document.querySelector('.wrapper');
const wrapperRect = wrapper.getBoundingClientRect();

const wrapperBody = Bodies.rectangle(
  wrapperRect.left + wrapperRect.width / 2,
  wrapperRect.top + wrapperRect.height / 2,
  wrapperRect.width,
  wrapperRect.height,
  {
    isStatic: true,
    render: {
      fillStyle: "transparent",
      strokeStyle: "transparent",
      opacity: 0,
      visible: false,
    },
    collisionFilter: {
      mask: 0x0001, // Chỉ chặn các shape, không chặn chuột
    }
  }
);

World.add(world, wrapperBody);



function isOverlappingLogin(x, y) {
  return (
    x > wrapperRect.left - 50 &&
    x < wrapperRect.right + 50 &&
    y > wrapperRect.top - 50 &&
    y < wrapperRect.bottom + 50
  );
}

if (window.innerWidth >= 720) {
  for (let i = 0; i < 6; i++) {
    let x, y, attempts = 0;
    do {
      x = i < 5
        ? Math.random() * (window.innerWidth / 2 - 100)
        : Math.random() * (window.innerWidth / 2 - 100) + (window.innerWidth / 2 + 100);
      y = Math.random() * window.innerHeight;
      attempts++;
    } while (isOverlappingLogin(x, y) && attempts < 10);

    const type = types[Math.floor(Math.random() * types.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const options = {
      restitution: 0.6,
      render: { fillStyle: color, opacity: 1 },
      collisionFilter: { category: 0x0001 },
      sleepThreshold: 60,
    };

    let shape;
    if (type === "circle") {
      shape = Bodies.circle(x, y, shapeSize / 2, options);
    } else if (type === "rectangle") {
      shape = Bodies.rectangle(x, y, shapeSize, shapeSize, options);
    } else {
      shape = Bodies.polygon(x, y, 3, shapeSize / 1.5, options);
    }

    Body.setVelocity(shape, {
      x: (Math.random() - 0.5) * 2.5,
      y: (Math.random() - 0.5) * 2.5,
    });

    shape.plugin = {
      frozen: false,
      active: true,
      freezeTimeout: setTimeout(() => {
        Body.setVelocity(shape, { x: 0, y: 0 });
        Body.setAngularVelocity(shape, 0);
        shape.plugin.frozen = true;
        shape.plugin.active = false;

        // Fade-out rồi ẩn
        shape.plugin.fadeTimer = setInterval(() => {
          shape.render.opacity -= 0.05;
          if (shape.render.opacity <= 0.05) {
            shape.render.opacity = 0;
            shape.render.visible = false;
            clearInterval(shape.plugin.fadeTimer);
          }
          isDirty = true;
        }, 100);
        isDirty = true;
      }, 6000 + Math.random() * 3000),
    };

    shapes.push(shape);
    World.add(world, shape);
  }
}

  const boundaries = [
    Bodies.rectangle(window.innerWidth / 2, -25, window.innerWidth, 50, { isStatic: true }),
    Bodies.rectangle(window.innerWidth / 2, window.innerHeight + 25, window.innerWidth, 50, { isStatic: true }),
    Bodies.rectangle(-25, window.innerHeight / 2, 50, window.innerHeight, { isStatic: true }),
    Bodies.rectangle(window.innerWidth + 25, window.innerHeight / 2, 50, window.innerHeight, { isStatic: true }),
  ];
  World.add(world, boundaries);

  const mouse = Mouse.create(render.canvas);
  mouse.pixelRatio = window.devicePixelRatio;
  mouse.offset = { x: 0, y: 0 };

  const mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    constraint: {
      stiffness: 0.3,
      render: { visible: false },
    },
  });
  mouseConstraint.collisionFilter.mask = 0x0001;
  World.add(world, mouseConstraint);

  render.canvas.addEventListener('mousemove', () => {
    const found = Matter.Query.point(shapes, mouse.position);
    render.canvas.style.cursor = found.length > 0 ? 'grab' : 'default';
  });
  Events.on(mouseConstraint, 'startdrag', () => {
    render.canvas.style.cursor = 'grabbing';
    isDirty = true;
  });
  Events.on(mouseConstraint, 'enddrag', () => {
    render.canvas.style.cursor = 'default';
    isDirty = true;
  });

  Events.on(mouseConstraint, 'startdrag', (event) => {
    const shape = event.body;
    if (!shape || !shape.plugin) return;

    shape.plugin.frozen = false;
    shape.plugin.active = true;

    shape.render.opacity = 1;
    shape.render.visible = true;

    if (shape.plugin.fadeTimer) clearInterval(shape.plugin.fadeTimer);

    Body.setVelocity(shape, {
      x: (Math.random() - 0.5) * 4,
      y: (Math.random() - 0.5) * 4,
    });

    isDirty = true;
  });

  Events.on(engine, 'collisionStart', (event) => {
    event.pairs.forEach(pair => {
      [pair.bodyA, pair.bodyB].forEach(body => {
        if (body.plugin && !body.plugin.active) {
          body.plugin.active = true;
          body.plugin.frozen = false;

          body.render.opacity = 1;
          body.render.visible = true;

          if (body.plugin.fadeTimer) clearInterval(body.plugin.fadeTimer);

          Body.setVelocity(body, {
            x: (Math.random() - 0.5) * 3,
            y: (Math.random() - 0.5) * 3,
          });

          isDirty = true;
        }
      });
    });
  });

  render.canvas.width = window.innerWidth * window.devicePixelRatio;
  render.canvas.height = window.innerHeight * window.devicePixelRatio;
  render.canvas.style.touchAction = 'none';

  let isDirty = true;
  function animate() {
    const hasActive = shapes.some(s => s.plugin?.active);

    if (hasActive || isDirty) {
      Engine.update(engine, 1000 / 60);
      Render.world(render);
      isDirty = false;
    }

    requestAnimationFrame(animate);
  }
  animate();
  if (window.innerWidth < 720) {
  render.canvas.style.display = "none"; // Ẩn hoàn toàn
}
