<script>
  let { width = 128, height = 128, class: className = '' } = $props();
</script>

<div
  class="logo-wrap {className}"
  style:width={`${width}px`}
  style:height={`${height}px`}
>
  <img src="/icon-192-white.png" alt="Dispatch Logo" />
</div>

<style>
  .logo-wrap {
    position: relative;
    display: inline-block;
    /* IMPORTANT: no background here */
    isolation: isolate; /* confine blending to this element’s stack */
  }

  .logo-wrap img {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* Colored overlay clipped to the PNG alpha, blends with the image only */
  .logo-wrap::after {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--primary, #7c3aed);

    /* Clip overlay to the non-transparent parts of the PNG */
    -webkit-mask: url("/icon-192-white.png") center / contain no-repeat;
            mask: url("/icon-192-white.png") center / contain no-repeat;

    /* Apply colorization while preserving luminance/detail from the image */
    mix-blend-mode: color;

    pointer-events: none;
  }

  /* Optional mild boost */
  .logo-wrap { filter: contrast(1.03) saturate(1.05); }
</style>
