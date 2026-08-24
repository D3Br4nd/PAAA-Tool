<script lang="ts">
	import { cn } from "$lib/utils/cn";

	type ButtonVariant =
		| "default"
		| "secondary"
		| "outline"
		| "ghost"
		| "link"
		| "destructive";
	type ButtonSize = "default" | "sm" | "lg" | "icon";

	export let variant: ButtonVariant = "default";
	export let size: ButtonSize = "default";
	export let href: string | undefined = undefined;
	export let disabled = false;
	let className = "";
	// Allow consumers to pass `class="..."` (shadcn-svelte convention)
	export { className as class };

	const base =
		"inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

	const variants: Record<ButtonVariant, string> = {
		default: "bg-primary text-primary-foreground hover:bg-primary/90",
		secondary:
			"bg-secondary text-secondary-foreground hover:bg-secondary/80",
		outline:
			"border border-input bg-background hover:bg-accent hover:text-accent-foreground",
		ghost: "hover:bg-accent hover:text-accent-foreground",
		link: "text-primary underline-offset-4 hover:underline",
		destructive:
			"bg-destructive text-destructive-foreground hover:bg-destructive/90",
	};

	const sizes: Record<ButtonSize, string> = {
		default: "h-10 px-4 py-2",
		sm: "h-9 rounded-md px-3",
		lg: "h-11 rounded-md px-8",
		icon: "h-10 w-10",
	};
</script>

<svelte:element
	this={href ? "a" : "button"}
	{href}
	type={href ? undefined : "button"}
	aria-disabled={disabled}
	disabled={href ? undefined : disabled}
	class={cn(base, variants[variant], sizes[size], className)}
	{...$$restProps}
>
	<slot />
</svelte:element>
